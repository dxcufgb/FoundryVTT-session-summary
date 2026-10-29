# Dxcufgb's Session Summary

[![Latest version](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-session-summary?label=version)](https://github.com/dxcufgb/FoundryVTT-session-summary/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-session-summary/total?label=downloads)](https://github.com/dxcufgb/FoundryVTT-session-summary/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/dxcufgb)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Records your play session and hands it to your Discord bot. Who landed the killing blows, who rolled the most natural 1s, who dropped to 0 HP and to what, which scenes the party spent the evening in. When the GM ends the session, a JSON summary and a ready-to-post Discord text are written to the Data folder, where a bot on the same computer picks them up.

**Foundry VTT:** v13 · **System:** dnd5e 5.x (tested with dnd5e 5.2.5 and midi-qol 13.0.67)

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-session-summary/releases/latest/download/module.json
```

Needs the dnd5e system (5.x). [midi-qol](https://foundryvtt.com/packages/midi-qol) is optional: its GM damage card tells exactly who landed each killing blow. Without it, the module uses dnd5e's attack and damage cards (see [Who gets the killing blow](#who-gets-the-killing-blow)).

## Recording a session

Recording runs on the **active GM's** client. Players don't need to do anything.

- When the GM logs in, the module asks whether to start recording **Session N** (change this in the settings to start automatically, or never).
- **Token controls → 📜 Session Summary** opens the window: live stats, title, GM notes, the Discord text, **Pause**, **End session**, **Export now**, downloads, and a trash button that discards the session without exporting it.
- **End session** stops recording and writes the files (if **Export when the session ends** is on). The session number then goes up by one.
- **Return to Setup** with a session still open asks first: **End session and return to setup** (the summary is written before the world closes), **Return without ending** (the session continues the next time the world is launched) or **Stay in the world**. If the summary can't be written, the world stays open so nothing is lost. Turn this off with **Remind me when returning to setup**.
- Reloading, crashing or switching GMs mid-session loses nothing: the session is saved in the world every 20 seconds. Time while Foundry is closed doesn't count towards the session length.
- If a session was never ended and the GM logs in hours later, the module asks whether it's a new session.

## What it records

| | |
| --- | --- |
| **Killing blows** | per character. A kill is an enemy (not player-owned, not friendly) dropping to 0 HP or being marked defeated, counted once. |
| **Damage** | dealt, taken, friendly fire, healing done and received, the biggest single damage roll |
| **Fallen heroes** | player characters dropping to 0 HP and what dropped them, death saves |
| **Fights** | number of fights, rounds, which enemies took part |
| **Dice** | player rolls only, per player and die type: rolls, 1s and max results. Natural 20s and 1s on d20 tests, split into attacks, saves, checks, death saves and initiative, and the d20 average |
| **Scenes** | the scenes the party spent time in (the active scene), in order, with time spent |
| **Distance** | walked per player character (Foundry's measured movement; undo subtracts, teleports don't count) |
| **Rests** | short and long rests (the whole party resting counts once) |
| **Achievements** | every character gets one per session (see below) |

### Who gets the killing blow

The module looks for the attacker in this order:

1. **midi-qol's GM damage card**, which names the attacker and every target.
2. dnd5e **attack, damage and activity cards**, which remember the targets the roller had selected.
3. **Whoever's combat turn it is**, if no card named an attacker (marked with a ? in the window, `"guessed": true` in the JSON).

The newest hit within the last minute counts. Summons, familiars and companions owned by a player credit that player's character. A character in wild shape or polymorphed (dnd5e makes the form a separate actor, such as "Name (Brown Bear)") is the same character: everything the form does, takes or walks counts for the original character, and the form never gets its own entry or achievement. If an enemy is healed back up within two minutes of its kill (midi's undo, or a GM correction), the kill is taken back.

### Achievements

Every character in the session gets **exactly one** achievement, shown with a short sentence saying what it is for (the small grey line under it in Discord), and no two characters get the same one. That includes characters who did nothing: every logged-in player's character is on the list. The rare and funny ones are handed out first whenever someone qualifies. Everyone else gets the best one that is true for them. A title is only repeated when a party is so big that every one is taken.

| | Achievement | Who gets it |
| --- | --- | --- |
| 😇 | **Session's Blessed** | most natural 20s |
| 🐈‍⬛ | **Session's Unluckiest** | most natural 1s |
| ✨ | **Death Defier** | rolled a natural 20 on a death save |
| 🐉 | **Giant Slayer** | killed the highest-CR enemy (CR 1 or more) |
| 🪓 | **Executioner** | most killing blows |
| ❤️‍🩹 | **Field Medic** | most healing done |
| 🐺 | **Beastmaster** | their summon or companion landed a killing blow |
| 💥 | **Heavy Hitter** | biggest single damage roll (10 or more) |
| 🛡️ | **Meat Shield** | most damage taken |
| 🪦 | **Floor Inspector** | dropped to 0 HP the most times |
| 😬 | **Friendly Fire** | most damage done to allies |
| 🔨 | **Wrecking Ball** | most damage dealt |
| 🏹 | **Sharpshooter** | best hit rate (at least 4 attacks against a known AC, 60 % or better) |
| 🎯 | **Stormtrooper** | most missed attacks (3 or more) |
| 🔥 | **Hot Dice** | highest d20 average (5+ d20 rolls, above 11.5) |
| 🧊 | **Cold Dice** | lowest d20 average (5+ d20 rolls, below 9.5) |
| 🩸 | **First Blood** | first kill of the session |
| 🎬 | **The Closer** | last kill of the session |
| 🧠 | **Iron Will** | most saving throws passed (2 or more) |
| 🫠 | **Weak Knees** | most saving throws failed (2 or more) |
| ⚡ | **Max Power** | most max results on any die (3 or more) |
| 🐍 | **Snake Eyes** | most 1s on any die (3 or more) |
| 🥾 | **Wanderer** | walked the furthest (60 ft or more) |
| 🤦 | **Butterfingers** | natural 1 on an attack roll |
| 👻 | **Untouchable** | took no damage in a session with fights |
| 🎲 | **Dice Goblin** | most rolls (10 or more) |
| 🍀 | **Lucky Streak** | two or more natural 20s |
| 🕊️ | **Pacifist** | took part but dealt no damage in a session with fights |
| ⚖️ | **Perfectly Average** | d20 average within 1 of 10.5 (3+ d20 rolls) |
| 🛋️ | **Homebody** | walked the least, under a third of the furthest walker (who walked 60 ft or more) |
| 🤫 | **The Quiet One** | five rolls or fewer |
| 🤝 📸 🪨 📣 🌟 🍪 🐴 | **Team Player, Sightseer, Steadfast, Moral Support, Main Character, Keeper of Snacks, Along for the Ride** | for everyone nothing else fits |

Hits and misses come from the target's AC, which dnd5e puts on attack rolls against a single target. Passed and failed saves come from the save DC when the save was requested with one. The achievements in the window are for the session so far and can change until the session ends.

### Dice

Only player rolls count: the GM's dice (monsters, NPCs) are not recorded. Only kept dice count: the dropped die of advantage or disadvantage and rerolled dice are ignored.

## The files

Written to `Data/session-summaries/` (change the folder in the settings). On Windows that is usually `%LOCALAPPDATA%\FoundryVTT\Data\session-summaries\`.

| File | |
| --- | --- |
| `session-014_2026-10-19.json` | the full summary |
| `session-014_2026-10-19.md` | the Discord text, never longer than 2000 characters |
| `latest.json` / `latest.md` | copies of the newest export (watch these) |
| `index.json` | every exported session of the world, newest first (written last) |

The file name is the session number (3 digits) and the date the session started, in the GM's local time. **Export now** mid-session writes the same files with `"inProgress": true` and `"endedAt": null`, so a bot can skip those. Exporting a session again overwrites its files and replaces its entry in `index.json`.

### index.json

```jsonc
{
  "schema": 1,
  "world": { "id": "…", "title": "…" },
  "updatedAt": "2026-10-19T20:45:00.000Z",
  "sessions": [{
    "id": "…", "number": 14, "title": "The Drowned Crypt",
    "startedAt": "2026-10-19T17:02:00.000Z", "endedAt": "…", "durationMinutes": 222, "kills": 23,
    "json": "session-014_2026-10-19.json", "md": "session-014_2026-10-19.md"
  }]
}
```

`json` and `md` are bare file names in the same folder. `index.json` is written after all the other files, so when it changes, the session's files are already there.

### Discord text

```md
## 📜 Session 14 — The Drowned Crypt
*Mon, Oct 19, 2026 · 3 h 42 min*

**⚔️ Combat** — enemies slain: 23 · fights: 4 · rounds: 17
**🏆 Killing blows:** Thorin 9 · Lyra 7 · Vex 5 · Aldric 2
**🩸 Damage dealt:** Vex 212 · Thorin 180 · Lyra 151 · Aldric 64
**💥 Biggest hit:** Vex — 38 (Rapier)
**🪦 Fallen heroes:** Aldric (by Ogre)

**🗺️ Scenes:** Sunken Gate (1 h 10 min) → Crypt Antechamber (52 min) → Ossuary (1 h 40 min)
**👣 Distance walked:** Vex 1,240 ft · Thorin 860 ft

**🎲 Dice**
Natural 20s: Lyra ×4 · Vex ×2
Natural 1s: Thorin ×5

**🏅 Achievements**
😇 **Lyra** — *Session's Blessed* · 4 natural 20s
-# Rolled the most natural 20s in the party.
🐈‍⬛ **Thorin** — *Session's Unluckiest* · 5 natural 1s
-# Rolled the most natural 1s in the party.
✨ **Aldric** — *Death Defier* · natural 20 on a death save
-# Rolled a natural 20 on a death saving throw and got back on their feet.
💥 **Vex** — *Heavy Hitter* · 38 damage in one roll (Rapier)
-# Rolled the biggest single damage roll of the session.
👻 **Pip** — *Untouchable* · no damage taken in 4 fights
-# Didn't take a single point of damage, even though there were fights.

> The party rang the drowned bell. Next: the Ossuary.
```

When a session has a lot going on, the text is shortened step by step until it fits one message: lists get shorter first, then the least important sections are left out (rests, the small per-player dice lines, distance, biggest hit, damage, then fallen heroes, scenes, dice and GM notes), then the achievement descriptions. Only for a very large party are the last achievements left out, with a line saying how many more there are. An achievement is never cut in the middle, and the JSON always has all of them.

### JSON layout (`schema: 1`)

```jsonc
{
  "schema": 1,
  "generator": { "module": "dxcufgbs-session-summary", "version": "1.0.0", "exportedAt": "…" },
  "session": {
    "id": "…", "number": 14, "title": "The Drowned Crypt", "notes": "…",
    "startedAt": "2026-10-19T17:02:00.000Z", "endedAt": "…", "inProgress": false,
    "durationMinutes": 222,
    "world": { "id": "…", "title": "…" }, "system": { "id": "dnd5e", "version": "5.2.5" }
  },
  "totals": {
    "kills": 23, "killsByPlayers": 23, "combats": 4, "rounds": 17,
    "damageDealt": 607, "damageTaken": 233, "healing": 58, "downs": 1,
    "rolls": 212, "nat20": 6, "nat1": 7, "scenes": 3, "shortRests": 1, "longRests": 0
  },
  "characters": [{
    "id": "…", "name": "Thorin", "player": "Anna",
    "kills": 9, "damageDealt": 180, "damageTaken": 94, "friendlyFire": 0,
    "healingDone": 0, "healingTaken": 22, "downs": 0,
    "deathSaves": { "success": 0, "failure": 0 },
    "distance": 860, "units": "ft", "nat20": 1, "nat1": 5,
    "rolls": 51, "ones": 9, "maxRolls": 6,
    "d20": { "count": 30, "average": 9.1, "nat20By": { "attack": 1, "…": 0 }, "nat1By": { "attack": 3, "save": 2, "…": 0 } },
    "attacks": { "total": 18, "hits": 10, "misses": 8 },
    "saves": { "passed": 1, "failed": 2 },
    "biggestHit": { "amount": 24, "item": "Greataxe", "via": null }
  }],
  "players": [{
    "id": "…", "name": "Anna", "characters": ["Thorin"], "rolls": 51,
    "d20": {
      "count": 30, "average": 9.8, "nat20": 1, "nat1": 5,
      "nat20By": { "attack": 1, "save": 0, "check": 0, "death": 0, "initiative": 0, "other": 0 },
      "nat1By":  { "attack": 3, "save": 1, "check": 1, "death": 0, "initiative": 0, "other": 0 }
    },
    "ones": 9, "maxRolls": 6,
    "dice": { "d12": { "rolled": 14, "ones": 2, "max": 3, "average": 6.1 }, "d20": { "rolled": 30, "ones": 5, "max": 1, "average": 9.8 } }
  }],
  "achievements": [{ "actorId": "…", "character": "Thorin", "player": "Anna", "id": "unluckiest", "emoji": "🐈‍⬛", "title": "Session's Unluckiest", "text": "5 natural 1s", "description": "Rolled the most natural 1s in the party." }],
  "kills": [{ "at": "…", "target": "Goblin", "cr": 0.25, "by": "Thorin", "via": null, "killer": null, "item": "Greataxe", "guessed": false, "scene": "Sunken Gate", "round": 2 }],
  "downs": [{ "at": "…", "character": "Aldric", "by": "Ogre", "scene": "Ossuary" }],
  "combats": [{ "scene": "Sunken Gate", "startedAt": "…", "endedAt": "…", "minutes": 18, "rounds": 4, "enemies": [{ "name": "Goblin", "count": 5 }] }],
  "scenes": [{ "id": "…", "name": "Sunken Gate", "minutes": 70, "visits": 1, "firstVisit": "…" }],
  "rests": [{ "at": "…", "type": "short", "characters": ["Thorin", "Lyra", "Vex", "Aldric"] }],
  "biggestHit": { "amount": 38, "character": "Vex", "actorId": "…", "item": "Rapier", "via": null, "at": "…" },
  "markdown": "## 📜 Session 14 — …"
}
```

- `kills[].by` is the character credited (`null` when nobody in the party did it; then `killer` names who did, if known). `via` is the summon or companion that actually landed the blow.
- `session.id` stays the same for a session, also when it is exported again. `session.world.id` is the Foundry world id. `title` and `notes` are `null` when empty.
- Fields may be added in later versions; `schema` only goes up when something is renamed or removed, or changes type or unit.

### Reading it from a bot (Node, discord.js)

```js
import { watch, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.env.LOCALAPPDATA, "FoundryVTT", "Data", "session-summaries");
let lastPosted = null;
let timer = null;

watch(dir, (event, file) => {
  if (file !== "latest.json") return;
  clearTimeout(timer);
  timer = setTimeout(async () => {          // wait for the write to finish
    const summary = JSON.parse(readFileSync(path.join(dir, "latest.json"), "utf8"));
    if (summary.session.inProgress || summary.session.id === lastPosted) return;
    lastPosted = summary.session.id;
    await channel.send(summary.markdown);   // or build an embed from the JSON
  }, 1000);
});
```

## Settings (GM only)

| Setting | Default | |
| --- | --- | --- |
| Next session number | 1 | Set it once to continue your campaign's numbering |
| Start recording | Ask the GM | Ask / start automatically / only from the window |
| Export when the session ends | on | Write the files as soon as the session ends |
| Remind me when returning to setup | on | Ask to end an open session when the GM returns to setup |
| Export folder | `session-summaries` | Folder inside the Data folder |

## Macro API

```js
const ss = game.modules.get("dxcufgbs-session-summary").api;
ss.open();                          // the Session Summary window
await ss.start();                   // GM: start recording → true, or false if a session is already open
await ss.pause(true);               // GM: pause (false resumes)
await ss.end();                     // GM: end (asks), then export if the setting is on → { ended, exported } or false
await ss.end({ confirm: false });   // GM: the same without asking
await ss.export();                  // GM: write the files now → { summary, files }, or null if nothing was written
ss.getSummary();                    // the summary as it would be exported right now (null without a session)
ss.getSession();                    // the raw recorded session (internal, may change: use getSummary())
```

- `start`, `pause` and `end` only work for the active GM; anyone else gets a warning (`start` and `end` then return `false`). `export` works for any GM and also for an ended session.
- `end` returns `false` when nothing was ended (no open session, or the GM said no). `exported` is `true` (files written), `false` (the write failed) or `null` (**Export when the session ends** is off).
- `files` are the paths written, relative to the Data folder: `session-summaries/session-014_2026-10-19.json`, `.md`, `latest.json`, `latest.md` and `index.json`, in that order.

Hook: `Hooks.on("dxcufgbs-session-summary.exported", (summary, files) => …)` after the files are written (**End session**, **Export now** or `export()`). It runs only on the GM's client that wrote them.

**From another module**

The API is set during `init`, so it is there from `setup` on. The session is loaded in `ready`, so `getSession()` and `getSummary()` return `null` before that.

```js
Hooks.once("ready", () => {
  const ss = game.modules.get("dxcufgbs-session-summary")?.active ? game.modules.get("dxcufgbs-session-summary").api : null;
  if (!ss) return;   // Session Summary not installed or not enabled
  Hooks.on("dxcufgbs-session-summary.exported", (summary, files) => console.log(summary.session.number, files));
});
```

## Notes

- Kills, damage and healing come from dnd5e's HP-change hooks, so they work for linked and unlinked tokens and however the HP changed: chat card buttons, midi-qol, the token HUD or the sheet.
- "Scenes" is the active scene, which is the one the players are looking at. Scenes the GM only previews don't count.
- Only the active GM records. With two GMs logged in, the other one sees the window read-only.

## License

MIT
