# Changelog

## 1.0.0

- First release: records a session on the active GM's client and writes a summary for a Discord bot.
- Killing blows per character (dnd5e attack / damage cards, midi-qol's GM damage card, or whoever's turn it is). Summons and companions credit their owner's character. A kill that is undone within two minutes is taken back.
- Damage dealt and taken, healing, friendly fire, heroes dropping to 0 HP (and by whom), death saves, biggest single damage roll.
- Dice per player (player rolls only, GM rolls aren't counted): rolls, 1s and max results per die type, d20 average, natural 20s and 1s split into attacks, saves, checks, death saves and initiative. Dice dropped by advantage / disadvantage don't count.
- Fights (rounds, enemies), short and long rests, distance walked per character, the scenes the party spent time in.
- Achievements: every character in the session gets exactly one, and no two the same (Session's Blessed, Session's Unluckiest, Death Defier, Giant Slayer, Executioner, Field Medic, Stormtrooper, Floor Inspector and 30 more). Every logged-in player's character counts, even if it did nothing.
- Per character: hits and misses (against the target's AC), saves passed and failed (against the DC), d20 average, 1s and max results.
- Returning to setup with a session still open asks whether to end it first, so its summary is written before the world closes (setting: Remind me when returning to setup).
- Session Summary window (Token controls): start, pause, end, title, GM notes, live stats, Discord preview, export, download.
- Export to `Data/session-summaries/`: `session-NNN_DATE.json` / `.md`, `latest.json` / `latest.md` and `index.json`. The Markdown always fits one Discord message (2000 characters).
