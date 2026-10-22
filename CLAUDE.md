# Dxcufgb's Session Summary

FoundryVTT v13 module (id `dxcufgbs-session-summary`, the install folder must have the same name) for dnd5e 5.x;
midi-qol is optional. Records a play session on the active GM's client (killing blows, damage, healing, downs,
fights, rests, distance, scenes, player dice, one achievement per character) and, when the session ends, writes a
JSON summary and a Discord-ready Markdown text to Foundry's Data folder. The Discord bot
`dxcufgb/FoundryVTT-discord-integration` (`src/sessionSummaries.js`) reads those files and posts them. No build step
and no npm dependencies.

## Layout
- `scripts/main.js` – settings, the module API (`game.modules.get(id).api`: `open`, `start`, `end`, `pause`, `export`, `getSession`, `getSummary`), the Token-controls button, `ready` startup.
- `scripts/constants.js` – `MODULE_ID`, `SCHEMA_VERSION`, timings (`TICK_MS`, `SAVE_MS`, `HIT_MEMORY_MS`, `SETTLE_MS`, `UNDO_KILL_MS`), `DISCORD_LIMIT`, `D20_CATEGORIES`.
- `scripts/state.js` – the recorded session (kept in the hidden world setting `session`), clock, scene time, actor/user records, `creditFor` / `isPC` / `isEnemy` / `ownerOf`.
- `scripts/trackers.js` – the hooks that count things: chat messages (rolls, targets, rests), `dnd5e.damageActor` / `dnd5e.healActor` (damage, kills, downs), combat, `moveToken`, scene changes.
- `scripts/summary.js` – `buildSummary` (the exported JSON) and `buildMarkdown` (the Discord text, always ≤ 2000 characters).
- `scripts/achievements.js` – `ACHIEVEMENTS` and `assignAchievements` (Hungarian algorithm: exactly one per character, no duplicates unless the party outgrows the fallbacks).
- `scripts/export.js` – writes the files to the Data folder (`FilePicker.upload`), `index.json`, the `dxcufgbs-session-summary.exported` hook, downloads.
- `scripts/flow.js` – start / pause / end / export / discard with the GM dialogs, the stale-session prompt, and the `game.shutDown` wrapper that asks before "Return to Setup".
- `scripts/app.js`, `templates/session-window.hbs`, `styles/session-summary.css` – the Session Summary window (ApplicationV2).
- `.github/workflows/ci.yml` / `release.yml` – thin callers of `dxcufgb/foundry-module-ci` (checks, packaging, release); identical in every module, do not edit here.

## Conventions
- `MODULE_ID` must equal `id` in `module.json`; every visible setting needs a Name and Hint in `lang/en.json` (CI checks both).
- All strings are under `DXSS.*` in `lang/en.json`. A new achievement needs `DXSS.Achievement.<id>.Title`, `.Desc` and every key its `text()` uses (plus the `...One` singular where `tp` is used), and a row in the README's achievements table.
- README documents the files, the JSON layout, the achievements and the settings: update it with any change there. User-visible changes go in `CHANGELOG.md`.

## Review focus
- **The export is a contract with the Discord bot.** Files in the export folder (setting `folder`, default `session-summaries` inside Data): `session-NNN_YYYY-MM-DD.json` / `.md` (`baseName`: number padded to 3, local start date), `latest.json` / `latest.md`, and `index.json` = `{ schema, world, updatedAt, sessions: [{ id, number, title, startedAt, endedAt, durationMinutes, kills, json, md }] }`, newest first, written last. The bot uses:
  - `index.json` `sessions[].json` / `.md`: bare file names in the same folder (it rejects paths and dotfiles); `latest.json` / `latest.md` only when `index.json` is missing.
  - In a summary: `schema`, `session.id` (stable for a session, so re-exports are not posted twice), `session.world.id` (must be the Foundry world id), `session.inProgress` (true for "Export now" mid-session; skipped), `session.endedAt` (ISO string; too old or missing = skipped), `session.number`, `session.title`, and `markdown` (the text it posts).
  - Renaming or removing any field, changing a type or unit, or changing file names needs a `SCHEMA_VERSION` bump **and** a matching change in the bot (`SUMMARY_SCHEMA` in `src/sessionSummaries.js`): for an unknown schema the bot only posts the `markdown` field. Adding fields is fine without a bump (README says so).
- **Only the active GM records and writes.** Every hook in `trackers.js` runs on every client and must check `isRecording()` (active GM, open, not paused); `state.save()` only writes for `game.user.isActiveGM`; other GMs `adopt` the setting and see the window read-only. Nothing may be counted once per connected client.
- **Counting rules that must not regress**: only player rolls (GM rolls are never recorded), only kept dice (`keptResults`), each roll once per message (`markSeen`, merged midi cards), a kill counted once per enemy (`killed` map, restored by `restoreKills` after a reload), an undo within `UNDO_KILL_MS` takes the kill back, summons credit their owner's character (`creditFor`), teleports and `displace` moves are not distance.
- **Discord text**: `buildMarkdown` must stay within `DISCORD_LIMIT` for any party size and never cut an achievement in the middle; check new sections get a priority so they can be dropped.
- **Return to Setup**: the `game.shutDown` wrapper must never stop the GM from leaving because of an error in this module, and must keep the world open when the export failed.
- **Escaping**: the template uses `{{ }}` only (titles, notes and names are user text); HTML built for dialogs uses `escapeHTML` (`esc`) for anything not a number or a localized string.
- **Privacy**: the export contains names, Foundry user/actor ids, the GM's title and notes. Never add chat message text or other user data to it.
- `dnd5e` lookups (`flags.dnd5e`, `CONFIG.Dice.D20Roll`, `system.attributes.hp`) and midi-qol flags must be optional-chained: midi-qol may be absent.
