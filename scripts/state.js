/**
 * The session being recorded. Only the active GM records; the session lives in a hidden world
 * setting so a reload, a crash or another GM taking over continues where it left off.
 */

import { MODULE_ID, SCHEMA_VERSION, TICK_MS, MAX_GAP_MS, SAVE_MS, SEEN_MESSAGES } from "./constants.js";

let session = null;
let dirty = false;
let tickTimer = null;
let saveTimer = null;
const listeners = new Set();

/* -------------------------------------------- */
/*  Access                                      */
/* -------------------------------------------- */

export const getSession = () => session;

/** Is an open, unpaused session being recorded on this client? */
export function isRecording() {
  return !!session && !session.endedAt && !session.paused && !!game.user?.isActiveGM;
}

/** Is there an open session (paused or not)? */
export const isOpen = () => !!session && !session.endedAt;

/** Something changed: save soon and tell open windows. */
export function markDirty() {
  dirty = true;
  for (const fn of listeners) {
    try { fn(session); } catch (err) { console.error(MODULE_ID, err); }
  }
}

/** Call `fn(session)` whenever the session changes. Returns an unsubscribe function. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* -------------------------------------------- */
/*  Lifecycle                                   */
/* -------------------------------------------- */

export function blankSession(number) {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION,
    id: foundry.utils.randomID(),
    number,
    title: "",
    notes: "",
    startedAt: now,
    endedAt: null,
    lastSeen: now,
    activeMs: 0,
    paused: false,
    world: { id: game.world.id, title: game.world.title },
    system: { id: game.system.id, version: game.system.version },
    scenes: {},
    sceneOrder: [],
    currentScene: null,
    users: {},
    actors: {},
    kills: [],
    downs: [],
    combats: [],
    rests: [],
    biggestHit: null,
    seen: {}
  };
}

/** Load the saved session (if any) and start the clock. */
export function load() {
  const saved = game.settings.get(MODULE_ID, "session");
  session = saved && typeof saved === "object" && saved.id ? foundry.utils.deepClone(saved) : null;
  startTimers();
  return session;
}

export function start() {
  const number = game.settings.get(MODULE_ID, "nextNumber") || 1;
  session = blankSession(number);
  const scene = game.scenes.active;
  if (scene) setScene(scene);
  markDirty();
  return save(true);
}

export function setPaused(paused) {
  if (!isOpen()) return;
  tick();
  session.paused = !!paused;
  markDirty();
  return save(true);
}

/** Close the session. Returns the closed session. */
export async function end() {
  if (!isOpen()) return session;
  tick();
  const now = Date.now();
  for (const c of session.combats) if (!c.endedAt) c.endedAt = now;
  session.endedAt = now;
  session.currentScene = null;
  markDirty();
  await save(true);
  await game.settings.set(MODULE_ID, "nextNumber", (session.number || 0) + 1);
  return session;
}

/** Forget the current session without exporting it. */
export async function discard() {
  session = null;
  markDirty();
  dirty = false;
  await game.settings.set(MODULE_ID, "session", null);
}

/** Write the session to the world (only the active GM writes). */
export async function save(force = false) {
  if (!game.user?.isActiveGM) return;
  if (!dirty && !force) return;
  dirty = false;
  if (session) trimSeen();
  try {
    await game.settings.set(MODULE_ID, "session", session ? foundry.utils.deepClone(session) : null);
  } catch (err) {
    dirty = true;
    console.error(`${MODULE_ID} | could not save the session`, err);
  }
}

/** Replace the session (another GM changed it). */
export function adopt(data) {
  if (game.user?.isActiveGM) return;
  session = data && data.id ? foundry.utils.deepClone(data) : null;
  for (const fn of listeners) fn(session);
}

/* -------------------------------------------- */
/*  Clock                                       */
/* -------------------------------------------- */

function startTimers() {
  clearInterval(tickTimer);
  clearInterval(saveTimer);
  // A short reload counts as session time; a long gap (Foundry was closed) does not.
  if (session && !session.endedAt && Date.now() - (session.lastSeen ?? 0) > MAX_GAP_MS) session.lastSeen = Date.now();
  tickTimer = setInterval(() => { if (game.user?.isActiveGM && tick()) markDirty(); }, TICK_MS);
  saveTimer = setInterval(() => save(), SAVE_MS);
  window.addEventListener("beforeunload", () => { if (dirty) save(true); });
}

/**
 * Add the time since the last tick to the session and the current scene. A gap longer than
 * MAX_GAP_MS (Foundry was closed) is skipped. Returns true when time was added.
 */
export function tick() {
  if (!isOpen()) return false;
  const now = Date.now();
  let delta = now - (session.lastSeen ?? now);
  session.lastSeen = now;
  if (delta <= 0 || delta > MAX_GAP_MS || session.paused) return false;
  session.activeMs += delta;
  const s = session.scenes[session.currentScene];
  if (s) s.ms += delta;
  return true;
}

/* -------------------------------------------- */
/*  Scenes                                      */
/* -------------------------------------------- */

/** The party is now on this scene (the active scene). */
export function setScene(scene) {
  if (!isOpen() || !scene) return;
  tick();
  if (session.currentScene === scene.id) return;
  let s = session.scenes[scene.id];
  if (!s) {
    s = session.scenes[scene.id] = { name: scene.navName || scene.name, firstAt: Date.now(), ms: 0, visits: 0 };
    session.sceneOrder.push(scene.id);
  }
  s.name = scene.navName || scene.name || s.name;
  s.visits += 1;
  session.currentScene = scene.id;
  markDirty();
}

/* -------------------------------------------- */
/*  Records                                     */
/* -------------------------------------------- */

/** The stats record of a player character (created on first use). */
export function actorRecord(actor) {
  actor = originalActor(actor);
  const id = actor.id;
  let r = session.actors[id];
  if (!r) {
    r = session.actors[id] = {
      name: actor.name, img: actor.img, player: null, userId: null,
      kills: 0, damageDealt: 0, damageTaken: 0, friendlyFire: 0,
      healingDone: 0, healingTaken: 0, downs: 0,
      distance: 0, units: "",
      biggestHit: null,
      nat20: 0, nat1: 0,
      deathSaves: { success: 0, failure: 0 }
    };
  }
  // Added in 1.0 for achievements (older saved sessions lack them)
  r.rolls ??= 0;
  r.ones ??= 0;
  r.maxRolls ??= 0;
  r.d20 ??= { count: 0, sum: 0, nat20: {}, nat1: {} };
  r.attacks ??= { total: 0, hits: 0, misses: 0 };
  r.saves ??= { passed: 0, failed: 0 };
  const owner = ownerOf(actor);
  r.name = actor.name;
  r.img = actor.img;
  if (owner) { r.player = owner.name; r.userId = owner.id; }
  return r;
}

/** The dice record of a user (created on first use). */
export function userRecord(user) {
  let r = session.users[user.id];
  if (!r) {
    r = session.users[user.id] = {
      name: user.name, isGM: user.isGM, color: user.color?.css ?? String(user.color ?? ""),
      characters: [], rolls: 0, dice: {},
      d20: { count: 0, sum: 0, nat20: {}, nat1: {} }
    };
  }
  r.name = user.name;
  return r;
}

/** Remember which rolls of a message were counted. Returns false if this one already was. */
export function markSeen(messageId, key) {
  const list = session.seen[messageId] ??= [];
  if (list.includes(key)) return false;
  list.push(key);
  return true;
}

function trimSeen() {
  const ids = Object.keys(session.seen ?? {});
  if (ids.length <= SEEN_MESSAGES) return;
  for (const id of ids.slice(0, ids.length - SEEN_MESSAGES)) delete session.seen[id];
}

/* -------------------------------------------- */
/*  Ownership helpers                           */
/* -------------------------------------------- */

/** The (non-GM) player who owns an actor. Prefers the user whose assigned character it is. */
export function ownerOf(actor) {
  if (!actor) return null;
  const base = actor.isToken ? (game.actors.get(actor.id) ?? actor) : actor;
  const players = game.users.filter(u => !u.isGM);
  return players.find(u => u.character?.id === base.id)
    ?? players.find(u => base.testUserPermission?.(u, "OWNER"))
    ?? null;
}

/**
 * The character behind a wild shape or polymorph: dnd5e makes the new form a separate actor
 * ("Name (Brown Bear)") with flags.dnd5e.originalActor. Its stats belong to the original
 * character. Any other actor is returned as it is.
 */
export function originalActor(actor) {
  let a = actor;
  // A form can be transformed again (bear -> owl): follow the chain, but never loop
  for (let i = 0; i < 5 && a; i++) {
    const id = a.flags?.dnd5e?.originalActor;
    const original = id && id !== a.id ? game.actors?.get(id) : null;
    if (!original) break;
    a = original;
  }
  return a;
}

/** Is this a player character (owned by a player, character type)? */
export function isPC(actor) {
  return !!actor && actor.type === "character" && actor.hasPlayerOwner;
}

/**
 * The player character that gets the credit for something this actor did. A summon, familiar or
 * companion owned by a player credits that player's character. Returns { pc, via } or null.
 */
export function creditFor(actor) {
  if (!actor) return null;
  if (isPC(actor)) {
    const base = originalActor(actor);
    return { pc: originalActor(game.actors.get(base.id) ?? base), via: null };
  }
  if (!actor.hasPlayerOwner) return null;
  const owner = ownerOf(actor);
  const pc = owner?.character ?? game.actors.find(a => a.type === "character" && owner && a.testUserPermission(owner, "OWNER"));
  return pc ? { pc: originalActor(pc), via: actor.name } : null;
}

/** Hostile-ish: not owned by a player and not friendly. */
export function isEnemy(actor) {
  if (!actor || actor.hasPlayerOwner) return false;
  const disposition = actor.token?.disposition ?? actor.getActiveTokens?.()[0]?.document?.disposition
    ?? actor.prototypeToken?.disposition;
  return disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}
