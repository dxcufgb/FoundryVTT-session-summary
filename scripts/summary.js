/**
 * Turns a recorded session into the exported summary (JSON for bots) and a short Markdown text
 * that fits in one Discord message.
 */

import { MODULE_ID, SCHEMA_VERSION, DISCORD_LIMIT, D20_CATEGORIES } from "./constants.js";
import { assignAchievements } from "./achievements.js";

const t = (key, data) => data ? game.i18n.format(`DXSS.${key}`, data) : game.i18n.localize(`DXSS.${key}`);
/** Plural-aware: uses "<key>One" when count is 1 and that key exists. */
const tp = (key, count, data) => t(count === 1 && game.i18n.has(`DXSS.${key}One`) ? `${key}One` : key, data);
const iso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const minutes = ms => Math.round((ms ?? 0) / 60_000);
const sumValues = obj => Object.values(obj ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
const round1 = n => Math.round(n * 10) / 10;

/** "3 h 42 min" / "52 min" */
export function formatDuration(ms) {
  const m = minutes(ms);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return t("Time.Minutes", { m: rest });
  if (!rest) return t("Time.Hours", { h });
  return t("Time.HoursMinutes", { h, m: rest });
}

const num = n => Number(n ?? 0).toLocaleString(game.i18n.lang || "en");

/* -------------------------------------------- */
/*  Summary (the JSON file)                     */
/* -------------------------------------------- */

/**
 * @param {object} session                The recorded session.
 * Only player rolls are recorded (GM rolls never reach the session), so every entry in
 * `players` is a player.
 */
export function buildSummary(session) {
  const ended = session.endedAt ?? null;

  const characters = Object.entries(session.actors ?? {}).map(([id, a]) => ({
    id,
    name: a.name,
    player: a.player,
    kills: a.kills,
    damageDealt: a.damageDealt,
    damageTaken: a.damageTaken,
    friendlyFire: a.friendlyFire,
    healingDone: a.healingDone,
    healingTaken: a.healingTaken,
    downs: a.downs,
    deathSaves: { ...a.deathSaves },
    distance: Math.round(a.distance),
    units: a.units || "ft",
    nat20: a.nat20,
    nat1: a.nat1,
    rolls: a.rolls ?? 0,
    ones: a.ones ?? 0,
    maxRolls: a.maxRolls ?? 0,
    d20: {
      count: a.d20?.count ?? 0,
      average: a.d20?.count ? round1(a.d20.sum / a.d20.count) : null,
      nat20By: Object.fromEntries(D20_CATEGORIES.map(c => [c, a.d20?.nat20?.[c] ?? 0])),
      nat1By: Object.fromEntries(D20_CATEGORIES.map(c => [c, a.d20?.nat1?.[c] ?? 0]))
    },
    attacks: { ...(a.attacks ?? { total: 0, hits: 0, misses: 0 }) },
    saves: { ...(a.saves ?? { passed: 0, failed: 0 }) },
    biggestHit: a.biggestHit ? { amount: a.biggestHit.amount, item: a.biggestHit.item, via: a.biggestHit.via } : null
  })).sort((x, y) => (y.kills - x.kills) || (y.damageDealt - x.damageDealt) || x.name.localeCompare(y.name));

  const players = Object.entries(session.users ?? {}).filter(([, u]) => !u.isGM).map(([id, u]) => {
    const nat20 = sumValues(u.d20.nat20);
    const nat1 = sumValues(u.d20.nat1);
    const dice = {};
    for (const [die, d] of Object.entries(u.dice ?? {}).sort((a, b) => parseInt(a[0].slice(1)) - parseInt(b[0].slice(1)))) {
      dice[die] = { rolled: d.rolled, ones: d.ones, max: d.max, average: d.rolled ? round1(d.sum / d.rolled) : null };
    }
    const byCategory = src => Object.fromEntries(D20_CATEGORIES.map(c => [c, src?.[c] ?? 0]));
    return {
      id,
      name: u.name,
      characters: [...(u.characters ?? [])],
      rolls: u.rolls,
      d20: {
        count: u.d20.count,
        average: u.d20.count ? round1(u.d20.sum / u.d20.count) : null,
        nat20,
        nat1,
        nat20By: byCategory(u.d20.nat20),
        nat1By: byCategory(u.d20.nat1)
      },
      ones: Object.values(dice).reduce((a, d) => a + d.ones, 0),
      maxRolls: Object.values(dice).reduce((a, d) => a + d.max, 0),
      dice
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const scenes = (session.sceneOrder ?? []).map(id => {
    const s = session.scenes[id];
    return { id, name: s.name, minutes: minutes(s.ms), visits: s.visits, firstVisit: iso(s.firstAt) };
  });

  const combats = (session.combats ?? []).map(c => ({
    scene: c.scene,
    startedAt: iso(c.startedAt),
    endedAt: iso(c.endedAt),
    minutes: c.endedAt ? minutes(c.endedAt - c.startedAt) : null,
    rounds: c.rounds,
    enemies: Object.entries(c.enemies ?? {}).map(([name, ids]) => ({ name, count: ids.length }))
  }));

  const kills = (session.kills ?? []).map(k => ({
    at: iso(k.at), target: k.target, cr: k.cr, by: k.by, via: k.via, killer: k.killer,
    item: k.item, guessed: k.guessed, scene: k.scene, round: k.round
  }));

  const counted = players;
  const totals = {
    kills: kills.length,
    killsByPlayers: kills.filter(k => k.by).length,
    combats: combats.length,
    rounds: combats.reduce((a, c) => a + (c.rounds || 0), 0),
    damageDealt: characters.reduce((a, c) => a + c.damageDealt, 0),
    damageTaken: characters.reduce((a, c) => a + c.damageTaken, 0),
    healing: characters.reduce((a, c) => a + c.healingDone, 0),
    downs: (session.downs ?? []).length,
    rolls: counted.reduce((a, p) => a + p.rolls, 0),
    nat20: counted.reduce((a, p) => a + p.d20.nat20, 0),
    nat1: counted.reduce((a, p) => a + p.d20.nat1, 0),
    scenes: scenes.length,
    shortRests: (session.rests ?? []).filter(r => r.type === "short").length,
    longRests: (session.rests ?? []).filter(r => r.type === "long").length
  };

  const summary = {
    schema: SCHEMA_VERSION,
    generator: { module: MODULE_ID, version: game.modules.get(MODULE_ID)?.version ?? null, exportedAt: new Date().toISOString() },
    session: {
      id: session.id,
      number: session.number,
      title: session.title || null,
      notes: session.notes || null,
      startedAt: iso(session.startedAt),
      endedAt: iso(ended),
      inProgress: !ended,
      durationMinutes: minutes(session.activeMs),
      world: session.world,
      system: session.system
    },
    totals,
    characters,
    players,
    achievements: [],
    kills,
    downs: (session.downs ?? []).map(d => ({ at: iso(d.at), character: d.character, by: d.by, scene: d.scene })),
    combats,
    scenes,
    rests: (session.rests ?? []).map(r => ({ at: iso(r.at), type: r.type, characters: [...r.characters] })),
    biggestHit: session.biggestHit ? { ...session.biggestHit, at: iso(session.biggestHit.at) } : null
  };
  summary.achievements = assignAchievements(characters, {
    kills: [...(session.kills ?? [])].sort((a, b) => a.at - b.at),
    combats: totals.combats,
    scenes: totals.scenes
  });
  summary.markdown = buildMarkdown(summary);
  return summary;
}

/* -------------------------------------------- */
/*  Markdown (fits one Discord message)         */
/* -------------------------------------------- */

const joinList = (parts, sep = " · ") => parts.filter(Boolean).join(sep);

/**
 * Sections in order of importance. When the text is too long for Discord, the least important
 * sections are dropped first, then lists are shortened.
 */
export function buildMarkdown(summary, { limit = DISCORD_LIMIT } = {}) {
  const join = sections => sections.map(s => s.text).join("\n");
  // 1. Shorten the lists
  for (const maxItems of [8, 6, 4]) {
    const text = join(markdownSections(summary, { maxItems }));
    if (text.length <= limit) return text;
  }
  // 2. Leave out the least important sections; 3. then the achievement descriptions;
  // 4. then, only for a huge party, the last achievements (a line says how many more there are).
  // An achievement is always shown whole, never cut in the middle.
  const total = summary.achievements.length;
  const attempts = [{ descriptions: true, shown: total }];
  for (let shown = total; shown >= 0; shown--) attempts.push({ descriptions: false, shown });
  for (const options of attempts) {
    const text = fitSections(markdownSections(summary, { maxItems: 3, ...options }), limit);
    if (text != null) return text;
  }
  // Unreachable in practice (header and fight line only): drop whole lines from the end
  const lines = join(markdownSections(summary, { maxItems: 3, descriptions: false, shown: 0 })).split("\n");
  while (lines.length > 1 && lines.join("\n").length > limit) lines.pop();
  return lines.join("\n").slice(0, limit);
}

/**
 * Leave out optional sections, least important (highest priority number) first, then put back
 * whatever still fits, most important first. Returns the text, or null if it can't fit.
 */
function fitSections(sections, limit) {
  const keep = new Set(sections);
  const text = () => sections.filter(s => keep.has(s)).map(s => s.text).join("\n");
  const dropOrder = sections.filter(s => s.priority > 0).sort((a, b) => b.priority - a.priority);
  const dropped = [];
  while (text().length > limit && dropOrder.length) {
    const s = dropOrder.shift();
    keep.delete(s);
    dropped.push(s);
  }
  for (const s of dropped.sort((a, b) => a.priority - b.priority)) {
    keep.add(s);
    if (text().length > limit) keep.delete(s);
  }
  const out = text();
  return out.length <= limit ? out : null;
}

const TITLE_LIMIT = 100;
const NOTES_LIMIT = 600;

function markdownSections(s, { maxItems, descriptions = true, shown = Infinity }) {
  const out = [];
  const add = (priority, text) => { if (text) out.push({ priority, text }); };
  const top = (list, n = maxItems) => list.slice(0, n);
  const date = new Date(s.session.startedAt).toLocaleDateString(game.i18n.lang || "en", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  // Header
  const sessionTitle = String(s.session.title ?? "").trim();
  const title = sessionTitle
    ? t("Md.TitleNamed", { n: s.session.number, title: sessionTitle.length > TITLE_LIMIT ? `${sessionTitle.slice(0, TITLE_LIMIT - 1)}…` : sessionTitle })
    : t("Md.Title", { n: s.session.number });
  add(0, `## 📜 ${title}\n*${date} · ${formatDuration(s.session.durationMinutes * 60_000)}*`);

  // Combat
  const killers = s.characters.filter(c => c.kills > 0);
  if (s.totals.kills || s.totals.combats) {
    const lines = [`**⚔️ ${t("Md.Combat")}** — ${t("Md.CombatLine", { kills: s.totals.kills, combats: s.totals.combats, rounds: s.totals.rounds })}`];
    if (killers.length) lines.push(`**🏆 ${t("Md.KillingBlows")}:** ${joinList(top(killers).map(c => `${c.name} ${c.kills}`))}`);
    const other = s.totals.kills - s.totals.killsByPlayers;
    if (other > 0 && killers.length) lines.push(`-# ${t("Md.OtherKills", { n: other })}`);
    add(0, `\n${lines.join("\n")}`);
  }

  // Damage
  const dealers = s.characters.filter(c => c.damageDealt > 0).sort((a, b) => b.damageDealt - a.damageDealt);
  if (dealers.length) add(3, `**🩸 ${t("Md.DamageDealt")}:** ${joinList(top(dealers).map(c => `${c.name} ${num(c.damageDealt)}`))}`);
  if (s.biggestHit) {
    const how = [s.biggestHit.via, s.biggestHit.item].filter(Boolean).join(", ");
    const item = how ? ` (${how})` : "";
    add(4, `**💥 ${t("Md.BiggestHit")}:** ${s.biggestHit.character} — ${num(s.biggestHit.amount)}${item}`);
  }

  // Fallen heroes
  if (s.downs.length) {
    const downs = top(s.downs).map(d => d.by ? t("Md.DownedBy", { name: d.character, by: d.by }) : d.character);
    add(2, `**🪦 ${t("Md.Downed")}:** ${joinList(downs)}`);
  }

  // Scenes
  if (s.scenes.length) {
    const scenes = top(s.scenes.filter(x => x.minutes > 0 || s.scenes.length === 1), maxItems)
      .map(x => `${x.name} (${formatDuration(x.minutes * 60_000)})`);
    if (scenes.length) add(1, `\n**🗺️ ${t("Md.Scenes")}:** ${joinList(scenes, " → ")}`);
  }

  // Distance
  const walkers = s.characters.filter(c => c.distance > 0).sort((a, b) => b.distance - a.distance);
  if (walkers.length) add(5, `**👣 ${t("Md.Distance")}:** ${joinList(top(walkers).map(c => `${c.name} ${num(c.distance)} ${c.units}`))}`);

  // Rests
  if (s.totals.shortRests || s.totals.longRests) {
    add(7, `**🏕️ ${t("Md.Rests")}:** ${joinList([
      s.totals.shortRests ? tp("Md.ShortRests", s.totals.shortRests, { n: s.totals.shortRests }) : null,
      s.totals.longRests ? tp("Md.LongRests", s.totals.longRests, { n: s.totals.longRests }) : null
    ])}`);
  }

  // Dice
  const players = s.players.filter(p => p.rolls > 0);
  if (players.length) {
    const label = p => p.characters[0] ?? p.name;
    const lines = [`\n**🎲 ${t("Md.Dice")}**`];
    const n20 = players.filter(p => p.d20.nat20).sort((a, b) => b.d20.nat20 - a.d20.nat20);
    const n1 = players.filter(p => p.d20.nat1).sort((a, b) => b.d20.nat1 - a.d20.nat1);
    if (n20.length) lines.push(`${t("Md.Nat20s")}: ${joinList(top(n20).map(p => `${label(p)} ×${p.d20.nat20}`))}`);
    if (n1.length) lines.push(`${t("Md.Nat1s")}: ${joinList(top(n1).map(p => `${label(p)} ×${p.d20.nat1}`))}`);
    add(1, lines.join("\n"));
    const detail = top(players).map(p => `${label(p)}: ${t("Md.DiceLine", {
      avg: p.d20.average ?? "–", max: p.maxRolls, ones: p.ones, rolls: p.rolls
    })}`);
    add(6, detail.map(l => `-# ${l}`).join("\n"));
  }

  // Achievements: one per character, always shown (whole entries; see buildMarkdown)
  if (s.achievements.length) {
    const list = s.achievements.slice(0, shown);
    const lines = list.map(a => `${a.emoji} **${a.character}** — *${a.title}* · ${a.text}${descriptions ? `\n-# ${a.description}` : ""}`);
    const more = s.achievements.length - list.length;
    if (more > 0) lines.push(`-# ${tp("Md.MoreAchievements", more, { n: more })}`);
    add(0, `\n**🏅 ${t("Md.Achievements")}**\n${lines.join("\n")}`);
  }

  // GM notes
  if (s.session.notes) {
    let notes = s.session.notes.trim();
    if (notes.length > NOTES_LIMIT) notes = `${notes.slice(0, NOTES_LIMIT - 1).trimEnd()}…`;
    add(1, `\n> ${notes.split(/\r?\n/).join("\n> ")}`);
  }

  return out;
}
