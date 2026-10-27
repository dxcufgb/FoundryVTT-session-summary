/**
 * Everything that is counted during a session. All hooks here fire on every client; only the
 * active GM records (isRecording()).
 *
 * dnd5e 5.x: rolls are categorised from flags.dnd5e.roll.type, HP changes come from the
 * dnd5e.damageActor / dnd5e.healActor hooks (they fire on all clients, unlinked tokens included).
 *
 * Who did it: attack / damage / healing roll messages and activity cards remember their targets
 * (flags.dnd5e.targets), and midi-qol's GM damage card names the attacker (flags.midi-qol.actorUuid)
 * and every target. The most recent of those within HIT_MEMORY_MS wins. Without one, the actor
 * whose combat turn it is gets the credit.
 */

import { HIT_MEMORY_MS, SETTLE_MS, UNDO_KILL_MS } from "./constants.js";
import {
  getSession, isRecording, isOpen, markDirty, setScene, actorRecord, userRecord, markSeen,
  creditFor, isPC, isEnemy, originalActor, tick
} from "./state.js";

/** targetActorUuid -> { sourceUuid, at, item } */
const hits = new Map();
/** targetActorUuid -> { sourceUuid, at, item } for healing */
const heals = new Map();
/** Enemies currently counted as killed: actorUuid -> kill entry */
const killed = new Map();

export function registerTrackers() {
  Hooks.on("createChatMessage", message => onMessage(message));
  Hooks.on("updateChatMessage", (message, changed) => {
    if (changed.rolls || changed.flags) onMessage(message);
  });
  Hooks.on("dnd5e.damageActor", (actor, changes) => onHP(actor, changes));
  Hooks.on("dnd5e.healActor", (actor, changes) => onHP(actor, changes));
  Hooks.on("updateCombatant", (combatant, changed) => {
    if (changed.defeated === true && combatant.actor) onDefeated(combatant.actor);
  });
  Hooks.on("createActiveEffect", effect => {
    if (effect.statuses?.has?.(CONFIG.specialStatusEffects?.DEFEATED ?? "dead") && effect.parent instanceof Actor) onDefeated(effect.parent);
  });
  Hooks.on("updateCombat", (combat, changed) => onCombatUpdate(combat, changed));
  Hooks.on("deleteCombat", combat => onCombatEnd(combat));
  // Scene changes count even while paused (paused time isn't added to any scene)
  Hooks.on("updateScene", (scene, changed) => { if (changed.active === true && isOpen() && game.user.isActiveGM) setScene(scene); });
  Hooks.on("moveToken", (token, movement, operation) => onMove(token, movement, operation));
  Hooks.on("userConnected", (user, connected) => { if (connected) setTimeout(notePresentParty, 1000); });
}

/* -------------------------------------------- */
/*  Chat messages: rolls, targets, rests        */
/* -------------------------------------------- */

function onMessage(message) {
  if (!isRecording()) return;
  const session = getSession();
  if ((message.timestamp ?? Date.now()) < session.startedAt - 5_000) return;
  try {
    rememberTargets(message);
    countRolls(message);
    if (message.type === "rest") countRest(message);
  } catch (err) {
    console.error("dxcufgbs-session-summary | message", err);
  }
}

function speakerActor(message) {
  return ChatMessage.getSpeakerActor(message.speaker) ?? null;
}

function itemName(flags) {
  const uuid = flags?.item?.uuid;
  if (!uuid) return null;
  try { return fromUuidSync(uuid)?.name ?? null; } catch { return null; }
}

/** Remember who hit (or healed) whom. */
function rememberTargets(message) {
  const now = Date.now();
  const flags = message.flags?.dnd5e;
  const source = speakerActor(message);

  if (flags && source) {
    const type = flags.roll?.type;
    const origin = flags.originatingMessage ? game.messages.get(flags.originatingMessage) : null;
    const targets = flags.targets?.length ? flags.targets : (origin?.flags?.dnd5e?.targets ?? []);
    const item = itemName(flags) ?? itemName(origin?.flags?.dnd5e);
    const isHeal = type === "healing";
    const isHarm = ["attack", "damage"].includes(type) || flags.messageType === "usage";
    if (isHeal || isHarm) {
      for (const t of targets) {
        if (!t?.uuid) continue;
        (isHeal ? heals : hits).set(t.uuid, { sourceUuid: source.uuid, at: now, item });
        // A usage card can be a healing spell too
        if (flags.messageType === "usage") heals.set(t.uuid, { sourceUuid: source.uuid, at: now, item });
      }
    }
  }

  // midi-qol's GM damage card: the attacker and every target with old/new HP
  const midi = message.flags?.["midi-qol"];
  if (midi?.actorUuid && Array.isArray(midi.undoDamage)) {
    for (const entry of midi.undoDamage) {
      if (!entry?.actorUuid) continue;
      const healed = Number.isFinite(entry.oldHP) && Number.isFinite(entry.newHP) && entry.newHP > entry.oldHP;
      const prev = (healed ? heals : hits).get(entry.actorUuid);
      (healed ? heals : hits).set(entry.actorUuid, { sourceUuid: midi.actorUuid, at: now, item: prev?.sourceUuid === midi.actorUuid ? prev.item : null });
    }
  }
}

/** The actor who most recently hit (or healed) this target, or whose turn it is. */
function sourceOf(target, at, healing = false) {
  const memo = (healing ? heals : hits).get(target.uuid);
  if (memo && memo.at >= at - HIT_MEMORY_MS && memo.at <= at + SETTLE_MS * 2) {
    let actor = null;
    try { actor = fromUuidSync(memo.sourceUuid); } catch { /* deleted */ }
    if (actor && actor !== target) return { actor, item: memo.item };
  }
  const combat = game.combat;
  if (combat?.started && combat.combatant?.actor && combat.combatant.actor !== target) {
    return { actor: combat.combatant.actor, item: null, guessed: true };
  }
  return null;
}

/* -------------------------------------------- */
/*  Dice                                        */
/* -------------------------------------------- */

function rollCategory(message, roll) {
  const type = message.flags?.dnd5e?.roll?.type;
  const DamageRoll = CONFIG.Dice?.DamageRoll;
  const D20Roll = CONFIG.Dice?.D20Roll;
  if (message.flags?.core?.initiativeRoll) return "initiative";
  if (DamageRoll && roll instanceof DamageRoll) return (type === "healing" || roll.options?.type === "healing") ? "healing" : "damage";
  switch (type) {
    case "attack": return "attack";
    case "save": case "concentration": return "save";
    case "ability": case "skill": case "tool": case "check": return "check";
    case "death": return "death";
    case "damage": return "damage";
    case "healing": return "healing";
  }
  // midi-qol puts the attack roll on the item card
  if (D20Roll && roll instanceof D20Roll && (message.flags?.["midi-qol"] || message.flags?.dnd5e?.messageType === "usage")) return "attack";
  return "other";
}

/** Every die term in a roll, nested ones included. */
function diceOf(roll) {
  try { return roll.dice ?? []; } catch { return []; }
}

const keptResults = die => (die.results ?? []).filter(r => r.active !== false && !r.discarded && !r.rerolled);

/** The AC / DC a d20 roll was made against, if dnd5e knew it. */
function targetNumber(roll) {
  const n = Number(roll.options?.target);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** AC of the only target on the message (or the card it belongs to). */
function singleTargetAC(message) {
  const flags = message.flags?.dnd5e;
  const origin = flags?.originatingMessage ? game.messages.get(flags.originatingMessage) : null;
  const targets = flags?.targets?.length ? flags.targets : (origin?.flags?.dnd5e?.targets ?? []);
  const ac = targets.length === 1 ? Number(targets[0].ac) : NaN;
  return Number.isFinite(ac) ? ac : null;
}

function countRolls(message) {
  const rolls = message.rolls ?? [];
  if (!rolls.length) return;
  // Only player rolls count; the GM's dice (monsters, NPCs) are left out
  const user = message.author;
  if (!user || user.isGM) return;
  const actor = speakerActor(message);
  const credit = actor ? creditFor(actor) : null;
  let damageTotal = 0;
  let counted = false;

  rolls.forEach((roll, i) => {
    if (!roll?._evaluated) return;
    const key = `${i}|${roll.formula}|${roll.total}`;
    if (!markSeen(message.id, key)) return;
    counted = true;
    const category = rollCategory(message, roll);
    const u = userRecord(user);
    if (credit && !u.characters.includes(credit.pc.name)) u.characters.push(credit.pc.name);
    u.rolls += 1;
    // The character's own rolls (a companion's rolls don't count for its owner's luck)
    const a = credit && !credit.via ? actorRecord(credit.pc) : null;
    if (a) a.rolls += 1;

    for (const die of diceOf(roll)) {
      const faces = die.faces;
      if (!faces) continue;
      const d = u.dice[`d${faces}`] ??= { rolled: 0, ones: 0, max: 0, sum: 0 };
      for (const r of keptResults(die)) {
        d.rolled += 1;
        d.sum += r.result;
        if (r.result === 1) { d.ones += 1; if (a) a.ones += 1; }
        if (r.result === faces) { d.max += 1; if (a) a.maxRolls += 1; }
      }
    }

    // Natural 20s / 1s: the kept d20 of a d20 test
    const d20Roll = CONFIG.Dice?.D20Roll && roll instanceof CONFIG.Dice.D20Roll;
    const d20 = d20Roll || category !== "other" ? diceOf(roll).find(d => d.faces === 20) : null;
    const natural = d20 ? keptResults(d20)[0]?.result : undefined;
    if (Number.isFinite(natural) && !["damage", "healing"].includes(category)) {
      const cat = category;
      u.d20.count += 1;
      u.d20.sum += natural;
      if (natural === 20) u.d20.nat20[cat] = (u.d20.nat20[cat] ?? 0) + 1;
      if (natural === 1) u.d20.nat1[cat] = (u.d20.nat1[cat] ?? 0) + 1;
      if (a) {
        a.d20.count += 1;
        a.d20.sum += natural;
        if (natural === 20) { a.nat20 += 1; a.d20.nat20[cat] = (a.d20.nat20[cat] ?? 0) + 1; }
        if (natural === 1) { a.nat1 += 1; a.d20.nat1[cat] = (a.d20.nat1[cat] ?? 0) + 1; }
        if (category === "death") {
          if (natural === 20 || roll.total >= 10) a.deathSaves.success += 1;
          else a.deathSaves.failure += natural === 1 ? 2 : 1;
        }
        // Hit or miss: the target's AC (dnd5e puts it on the roll for a single target)
        if (category === "attack") {
          a.attacks.total += 1;
          const ac = targetNumber(roll) ?? singleTargetAC(message);
          const hit = natural === 20 ? true : natural === 1 ? false : (ac != null ? roll.total >= ac : null);
          if (hit === true) a.attacks.hits += 1;
          if (hit === false) a.attacks.misses += 1;
        }
        // Passed or failed save: the DC (on the roll when the save was requested with one)
        if (category === "save") {
          const dc = targetNumber(roll);
          if (dc != null) {
            if (roll.total >= dc) a.saves.passed += 1;
            else a.saves.failed += 1;
          }
        }
      }
    }

    if (category === "damage") damageTotal += Number(roll.total) || 0;
  });

  // Biggest single damage roll by a player character
  if (damageTotal > 0 && credit) {
    const session = getSession();
    const a = actorRecord(credit.pc);
    const flags = message.flags?.dnd5e;
    const origin = flags?.originatingMessage ? game.messages.get(flags.originatingMessage) : null;
    const item = itemName(flags) ?? itemName(origin?.flags?.dnd5e) ?? message.flags?.["midi-qol"]?.itemName ?? null;
    const hit = { amount: damageTotal, character: credit.pc.name, actorId: credit.pc.id, item, via: credit.via, at: Date.now() };
    if (!a.biggestHit || damageTotal > a.biggestHit.amount) a.biggestHit = hit;
    if (!session.biggestHit || damageTotal > session.biggestHit.amount) session.biggestHit = hit;
  }
  if (counted) markDirty();
}

/* -------------------------------------------- */
/*  Rests                                       */
/* -------------------------------------------- */

function countRest(message) {
  const type = message.system?.type;
  if (!["short", "long"].includes(type)) return;
  const actor = speakerActor(message);
  const name = (actor ? originalActor(actor).name : null) ?? message.speaker?.alias ?? "";
  const session = getSession();
  const now = Date.now();
  // The whole party resting at once is one rest
  const last = session.rests.at(-1);
  if (last && last.type === type && now - last.at < 5 * 60_000) {
    if (name && !last.characters.includes(name)) last.characters.push(name);
  } else {
    session.rests.push({ type, at: now, characters: name ? [name] : [] });
  }
  markDirty();
}

/* -------------------------------------------- */
/*  HP: damage, healing, kills, downs           */
/* -------------------------------------------- */

function onHP(actor, changes) {
  if (!isRecording()) return;
  const hp = actor.system?.attributes?.hp;
  if (!hp || !Number.isFinite(changes?.total)) return;
  const at = Date.now();
  const now = hp.value;
  const before = now - (changes.hp ?? 0);
  const amount = Math.abs(changes.total);
  // midi's damage card can arrive just after the HP change: decide a moment later
  setTimeout(() => {
    if (!isRecording()) return;
    try {
      if (changes.total < 0) onDamage(actor, amount, at, before, now);
      else onHeal(actor, amount, at, before, now);
    } catch (err) {
      console.error("dxcufgbs-session-summary | hp", err);
    }
  }, SETTLE_MS);
}

function onDamage(target, amount, at, before, now) {
  const source = sourceOf(target, at);
  const credit = source ? creditFor(source.actor) : null;

  if (credit) {
    const a = actorRecord(credit.pc);
    if (target.hasPlayerOwner) a.friendlyFire += amount;
    else a.damageDealt += amount;
  }
  if (isPC(target)) actorRecord(target).damageTaken += amount;

  if (before > 0 && now <= 0) {
    if (isPC(target)) recordDown(target, source, at);
    else if (isEnemy(target)) recordKill(target, source, at);
  }
  markDirty();
}

function onHeal(target, amount, at, before, now) {
  // An enemy brought back right after dying was an undo (or a mistake): take the kill back
  if (before <= 0 && now > 0) {
    const kill = killed.get(target.uuid);
    if (kill) {
      killed.delete(target.uuid);
      if (at - kill.at < UNDO_KILL_MS) removeKill(kill);
    }
  }
  const source = sourceOf(target, at, true);
  const credit = source ? creditFor(source.actor) : null;
  if (credit && !source.guessed) actorRecord(credit.pc).healingDone += amount;
  if (isPC(target)) actorRecord(target).healingTaken += amount;
  markDirty();
}

/** Marked defeated / dead without the HP reaching 0 through damage. */
function onDefeated(actor) {
  if (!isRecording() || !isEnemy(actor) || killed.has(actor.uuid)) return;
  const at = Date.now();
  setTimeout(() => {
    if (!isRecording() || killed.has(actor.uuid)) return;
    recordKill(actor, sourceOf(actor, at), at);
    markDirty();
  }, SETTLE_MS);
}

function recordKill(target, source, at) {
  if (killed.has(target.uuid)) return;
  const session = getSession();
  const credit = source ? creditFor(source.actor) : null;
  const kill = {
    at,
    target: target.token?.name ?? target.name,
    targetUuid: target.uuid,
    cr: target.system?.details?.cr ?? null,
    by: credit?.pc.name ?? null,
    actorId: credit?.pc.id ?? null,
    via: credit?.via ?? null,
    killer: credit ? null : (source?.actor?.name ?? null),
    item: source?.item ?? null,
    guessed: !!source?.guessed,
    scene: target.token?.parent?.name ?? game.scenes.active?.name ?? null,
    round: game.combat?.started ? game.combat.round : null
  };
  session.kills.push(kill);
  killed.set(target.uuid, kill);
  if (credit) actorRecord(credit.pc).kills += 1;
}

function removeKill(kill) {
  const session = getSession();
  const i = session.kills.findIndex(k => k.targetUuid === kill.targetUuid && k.at === kill.at);
  if (i < 0) return;
  session.kills.splice(i, 1);
  if (kill.actorId && session.actors[kill.actorId]) session.actors[kill.actorId].kills = Math.max(0, session.actors[kill.actorId].kills - 1);
}

function recordDown(target, source, at) {
  const session = getSession();
  const pc = originalActor(target);
  const a = actorRecord(pc);
  a.downs += 1;
  session.downs.push({
    at,
    character: pc.name,
    actorId: pc.id,
    by: source?.actor?.name ?? null,
    scene: game.scenes.active?.name ?? null
  });
}

/* -------------------------------------------- */
/*  Combat                                      */
/* -------------------------------------------- */

function openCombat(combat) {
  const session = getSession();
  let c = session.combats.find(x => x.id === combat.id && !x.endedAt);
  if (!c) {
    c = { id: combat.id, scene: combat.scene?.navName || combat.scene?.name || game.scenes.active?.name || null, startedAt: Date.now(), endedAt: null, rounds: 0, enemies: {} };
    session.combats.push(c);
  }
  return c;
}

function noteEnemies(combat, c) {
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || !isEnemy(actor)) continue;
    const name = actor.name ?? combatant.name;
    const ids = c.enemies[name] ??= [];
    if (!ids.includes(combatant.id)) ids.push(combatant.id);
  }
}

function onCombatUpdate(combat, changed) {
  if (!isRecording() || !("round" in changed) || !(combat.round > 0)) return;
  const c = openCombat(combat);
  c.rounds = Math.max(c.rounds, combat.round);
  noteEnemies(combat, c);
  markDirty();
}

function onCombatEnd(combat) {
  if (!isRecording()) return;
  const session = getSession();
  const c = session.combats.find(x => x.id === combat.id && !x.endedAt);
  if (!c) return;
  noteEnemies(combat, c);
  c.rounds = Math.max(c.rounds, combat.round ?? 0);
  c.endedAt = Date.now();
  markDirty();
}

/* -------------------------------------------- */
/*  Movement                                    */
/* -------------------------------------------- */

function onMove(token, movement, operation) {
  if (!isRecording()) return;
  const actor = token.actor;
  if (!isPC(actor)) return;
  if (operation?.teleport || movement?.destination?.action === "displace") return;
  let distance = Number(movement?.passed?.distance);
  if (!Number.isFinite(distance)) {
    try {
      const a = movement?.origin, b = movement?.destination;
      distance = a && b ? token.parent.grid.measurePath([a, b]).distance : 0;
    } catch { distance = 0; }
  }
  if (!(distance > 0)) return;
  const r = actorRecord(game.actors.get(actor.id) ?? actor);
  r.distance = Math.max(0, r.distance + (movement?.method === "undo" ? -distance : distance));
  r.units = token.parent?.grid?.units || r.units || "ft";
  markDirty();
}

/**
 * Every player who is logged in gets their character on the list, so nobody is left out of the
 * achievements even when their character did nothing the module can count.
 */
export function notePresentParty() {
  if (!isOpen() || !game.user.isActiveGM) return;
  let added = false;
  for (const user of game.users) {
    if (user.isGM || !user.active || !user.character) continue;
    const pc = originalActor(user.character);
    if (!getSession().actors[pc.id]) added = true;
    actorRecord(pc);
  }
  if (added) markDirty();
}

/** After a reload: enemies already counted stay counted (a later "defeated" toggle isn't a second kill). */
export function restoreKills() {
  killed.clear();
  hits.clear();
  heals.clear();
  for (const k of getSession()?.kills ?? []) killed.set(k.targetUuid, k);
}

export { tick };
