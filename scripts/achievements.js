/**
 * Session achievements: every character in the session gets exactly one, and no two characters
 * get the same one.
 *
 * Each achievement says when a character qualifies:
 *   most       the character is the party's best (ties allowed) at something, with a minimum
 *   least      the party's lowest at something
 *   threshold  the character did something at least N times (true for anyone who did)
 *   fallback   always true; for characters nothing else fits (no stats at all, a tiny session)
 *
 * The assignment maximises the total "priority" of the handed-out achievements (Hungarian
 * algorithm), so the rare and funny ones (Session's Blessed, Session's Unluckiest, Death Defier)
 * are handed out whenever someone qualifies, while still giving everyone something true.
 */

const t = (key, data) => data ? game.i18n.format(`DXSS.Achievement.${key}`, data) : game.i18n.localize(`DXSS.Achievement.${key}`);
const tp = (key, count, data) => t(count === 1 && game.i18n.has(`DXSS.Achievement.${key}One`) ? `${key}One` : key, data);
const num = n => Number(n ?? 0).toLocaleString(game.i18n.lang || "en");
const rate = c => {
  const known = c.attacks.hits + c.attacks.misses;
  return known >= 4 ? c.attacks.hits / known : null;
};
const active = c => c.rolls > 0 || c.distance > 0 || c.damageDealt > 0 || c.damageTaken > 0 || c.healingDone > 0;

/**
 * The achievements. `value(c, ctx)` returns a number (or null when it doesn't apply);
 * `text(c, ctx, value)` is the line shown under the title.
 */
export const ACHIEVEMENTS = [
  // ---- The party's best (or worst) at something -------------------------------------------
  { id: "blessed", emoji: "😇", priority: 100, mode: "most", min: 1,
    value: c => c.nat20, text: (c, x, v) => tp("blessed.Text", v, { n: v }) },
  { id: "unluckiest", emoji: "🐈‍⬛", priority: 99, mode: "most", min: 1,
    value: c => c.nat1, text: (c, x, v) => tp("unluckiest.Text", v, { n: v }) },
  { id: "giantSlayer", emoji: "🐉", priority: 92, mode: "most", min: 1,
    value: (c, x) => x.topCrKill && x.topCrKill.actorId === c.id ? Number(x.topCrKill.cr) : null,
    text: (c, x) => t("giantSlayer.Text", { target: x.topCrKill.target, cr: x.topCrKill.cr }) },
  { id: "executioner", emoji: "🪓", priority: 90, mode: "most", min: 1,
    value: c => c.kills, text: (c, x, v) => tp("executioner.Text", v, { n: v }) },
  { id: "medic", emoji: "❤️‍🩹", priority: 85, mode: "most", min: 1,
    value: c => c.healingDone, text: (c, x, v) => t("medic.Text", { n: num(v) }) },
  { id: "heavyHitter", emoji: "💥", priority: 80, mode: "most", min: 10,
    value: c => c.biggestHit?.amount ?? null,
    text: (c, x, v) => c.biggestHit?.item ? t("heavyHitter.TextItem", { n: v, item: c.biggestHit.item }) : t("heavyHitter.Text", { n: v }) },
  { id: "meatShield", emoji: "🛡️", priority: 78, mode: "most", min: 1,
    value: c => c.damageTaken, text: (c, x, v) => t("meatShield.Text", { n: num(v) }) },
  { id: "floorInspector", emoji: "🪦", priority: 77, mode: "most", min: 1,
    value: c => c.downs, text: (c, x, v) => tp("floorInspector.Text", v, { n: v }) },
  { id: "friendlyFire", emoji: "😬", priority: 76, mode: "most", min: 1,
    value: c => c.friendlyFire, text: (c, x, v) => t("friendlyFire.Text", { n: num(v) }) },
  { id: "wreckingBall", emoji: "🔨", priority: 75, mode: "most", min: 1,
    value: c => c.damageDealt, text: (c, x, v) => t("wreckingBall.Text", { n: num(v) }) },
  { id: "sharpshooter", emoji: "🏹", priority: 74, mode: "most", min: 0.6,
    value: rate, text: c => t("sharpshooter.Text", { hits: c.attacks.hits, n: c.attacks.hits + c.attacks.misses }) },
  { id: "stormtrooper", emoji: "🎯", priority: 72, mode: "most", min: 3,
    value: c => c.attacks.misses, text: (c, x, v) => t("stormtrooper.Text", { n: v }) },
  { id: "hotDice", emoji: "🔥", priority: 70, mode: "most", min: 11.5,
    value: c => c.d20.count >= 5 ? c.d20.average : null, text: (c, x, v) => t("hotDice.Text", { n: v }) },
  { id: "coldDice", emoji: "🧊", priority: 69, mode: "least", max: 9.5,
    value: c => c.d20.count >= 5 ? c.d20.average : null, text: (c, x, v) => t("coldDice.Text", { n: v }) },
  { id: "ironWill", emoji: "🧠", priority: 62, mode: "most", min: 2,
    value: c => c.saves.passed, text: (c, x, v) => t("ironWill.Text", { n: v }) },
  { id: "weakKnees", emoji: "🫠", priority: 61, mode: "most", min: 2,
    value: c => c.saves.failed, text: (c, x, v) => t("weakKnees.Text", { n: v }) },
  { id: "maxPower", emoji: "⚡", priority: 60, mode: "most", min: 3,
    value: c => c.maxRolls, text: (c, x, v) => t("maxPower.Text", { n: v }) },
  { id: "snakeEyes", emoji: "🐍", priority: 58, mode: "most", min: 3,
    value: c => c.ones, text: (c, x, v) => t("snakeEyes.Text", { n: v }) },
  { id: "wanderer", emoji: "🥾", priority: 55, mode: "most", min: 60,
    value: c => c.distance, text: (c, x, v) => t("wanderer.Text", { n: num(v), units: c.units }) },
  { id: "diceGoblin", emoji: "🎲", priority: 40, mode: "most", min: 10,
    value: c => c.rolls, text: (c, x, v) => t("diceGoblin.Text", { n: v }) },
  { id: "homebody", emoji: "🛋️", priority: 20, mode: "least",
    value: (c, x) => x.maxDistance >= 60 && c.distance <= x.maxDistance / 3 ? c.distance : null,
    text: c => t("homebody.Text", { n: num(c.distance), units: c.units }) },

  // ---- Things that happened ----------------------------------------------------------------
  { id: "deathDefier", emoji: "✨", priority: 95, mode: "threshold", min: 1,
    value: c => c.d20.nat20By.death, text: () => t("deathDefier.Text") },
  { id: "beastmaster", emoji: "🐺", priority: 82, mode: "threshold", min: 1,
    value: (c, x) => x.kills.filter(k => k.actorId === c.id && k.via).length,
    text: (c, x, v) => tp("beastmaster.Text", v, { n: v, via: x.kills.find(k => k.actorId === c.id && k.via).via }) },
  { id: "firstBlood", emoji: "🩸", priority: 65, mode: "threshold", min: 1,
    value: (c, x) => x.kills[0]?.actorId === c.id ? 1 : null, text: (c, x) => t("firstBlood.Text", { target: x.kills[0].target }) },
  { id: "closer", emoji: "🎬", priority: 64, mode: "threshold", min: 1,
    value: (c, x) => x.kills.length >= 2 && x.kills.at(-1).actorId === c.id ? 1 : null,
    text: (c, x) => t("closer.Text", { target: x.kills.at(-1).target }) },
  { id: "butterfingers", emoji: "🤦", priority: 50, mode: "threshold", min: 1,
    value: c => c.d20.nat1By.attack, text: (c, x, v) => tp("butterfingers.Text", v, { n: v }) },
  { id: "untouchable", emoji: "👻", priority: 45, mode: "threshold", min: 1,
    value: (c, x) => x.combats >= 1 && c.damageTaken === 0 && active(c) ? 1 : null,
    text: (c, x) => tp("untouchable.Text", x.combats, { n: x.combats }) },
  { id: "luckyStreak", emoji: "🍀", priority: 35, mode: "threshold", min: 2,
    value: c => c.nat20, text: (c, x, v) => t("luckyStreak.Text", { n: v }) },
  { id: "pacifist", emoji: "🕊️", priority: 30, mode: "threshold", min: 1,
    value: (c, x) => x.combats >= 1 && active(c) && c.damageDealt === 0 && c.kills === 0 ? 1 : null, text: () => t("pacifist.Text") },
  { id: "perfectlyAverage", emoji: "⚖️", priority: 25, mode: "threshold", min: 1,
    value: c => c.d20.count >= 3 && Math.abs(c.d20.average - 10.5) <= 1 ? 1 : null,
    text: c => t("perfectlyAverage.Text", { n: c.d20.average }) },
  { id: "quietOne", emoji: "🤫", priority: 6, mode: "threshold", min: 1,
    value: c => c.rolls <= 5 ? 1 : null,
    text: c => c.rolls ? tp("quietOne.Text", c.rolls, { n: c.rolls }) : t("quietOne.TextNone") },

  // ---- For everyone else (always true) -----------------------------------------------------
  { id: "teamPlayer", emoji: "🤝", priority: 5, mode: "fallback",
    text: (c, x) => x.combats ? tp("teamPlayer.Text", x.combats, { n: x.combats }) : t("teamPlayer.TextNone") },
  { id: "sightseer", emoji: "📸", priority: 4, mode: "fallback",
    text: (c, x) => x.scenes ? tp("sightseer.Text", x.scenes, { n: x.scenes }) : t("sightseer.TextNone") },
  { id: "steadfast", emoji: "🪨", priority: 3, mode: "fallback", text: () => t("steadfast.Text") },
  { id: "moralSupport", emoji: "📣", priority: 3, mode: "fallback", text: () => t("moralSupport.Text") },
  { id: "mainCharacter", emoji: "🌟", priority: 2, mode: "fallback", text: () => t("mainCharacter.Text") },
  { id: "snackKeeper", emoji: "🍪", priority: 2, mode: "fallback", text: () => t("snackKeeper.Text") },
  { id: "alongForTheRide", emoji: "🐴", priority: 1, mode: "fallback", text: () => t("alongForTheRide.Text") }
];

/* -------------------------------------------- */
/*  Who qualifies for what                      */
/* -------------------------------------------- */

/** Score of giving achievement `a` to character `c`, or null if it isn't true for them. */
function score(a, c, party, ctx) {
  if (a.mode === "fallback") return a.copy ? 0.001 : a.priority;
  const v = a.value(c, ctx);
  if (v == null || !Number.isFinite(v)) return null;
  if (a.mode === "threshold") return v >= a.min ? a.priority + Math.min(v, 5) * 0.2 : null;
  const values = party.map(p => a.value(p, ctx)).filter(x => x != null && Number.isFinite(x));
  if (a.mode === "most") return v >= a.min && v === Math.max(...values) ? a.priority : null;
  if (a.mode === "least") return (a.max == null || v <= a.max) && v === Math.min(...values) ? a.priority : null;
  return null;
}

/**
 * Hungarian algorithm (minimum cost), rows ≤ columns. Returns, for each row, its column.
 * cost[i][j] for i in rows, j in columns.
 */
function hungarian(cost) {
  const n = cost.length, m = cost[0].length;
  const INF = Number.MAX_SAFE_INTEGER;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) result[p[j] - 1] = j - 1;
  return result;
}

/* -------------------------------------------- */
/*  Hand them out                               */
/* -------------------------------------------- */

/**
 * @param {object[]} characters   summary.characters
 * @param {object} context        { kills, combats, scenes }
 * @returns {object[]}            one achievement per character, best first
 */
export function assignAchievements(characters, { kills = [], combats = 0, scenes = 0 } = {}) {
  if (!characters.length) return [];
  const party = [...characters].sort((a, b) => a.name.localeCompare(b.name));
  const credited = kills.filter(k => k.actorId);
  const topCrKill = credited.filter(k => Number.isFinite(Number(k.cr)))
    .sort((a, b) => Number(b.cr) - Number(a.cr) || (a.at < b.at ? -1 : 1))[0] ?? null;
  const ctx = {
    kills: credited,
    combats,
    scenes,
    topCrKill,
    maxDistance: Math.max(0, ...party.map(c => c.distance || 0))
  };

  // Columns: every achievement once; extra copies of the fallbacks if the party is huge
  const columns = [...ACHIEVEMENTS];
  const fallbacks = ACHIEVEMENTS.filter(a => a.mode === "fallback");
  // (there must be at least as many always-true slots as characters)
  // Copies score almost nothing, so a title is only repeated when every other one is taken.
  for (let i = 0; fallbacks.length + i < party.length; i++) columns.push({ ...fallbacks[i % fallbacks.length], copy: true });

  const scores = party.map(c => columns.map(a => score(a, c, party, ctx)));
  const BIG = 1e6;
  const cost = scores.map(row => row.map(s => s == null ? BIG : 1000 - s));
  const pick = hungarian(cost);

  return party.map((c, i) => {
    // Never hand out something that isn't true (can't happen with enough fallback slots)
    const a = scores[i][pick[i]] == null ? fallbacks[i % fallbacks.length] : columns[pick[i]];
    const value = a.value ? a.value(c, ctx) : null;
    return {
      actorId: c.id,
      character: c.name,
      player: c.player,
      id: a.id,
      emoji: a.emoji,
      title: t(`${a.id}.Title`),
      text: a.text(c, ctx, value),
      priority: a.priority
    };
  }).sort((a, b) => b.priority - a.priority || a.character.localeCompare(b.character))
    .map(({ priority, ...rest }) => rest);
}
