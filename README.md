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

Needs the dnd5e system (5.x); [midi-qol](https://foundryvtt.com/packages/midi-qol) is optional. Requirements and details: [Installation](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/Installation) in the wiki.

## Documentation

The full guide is in the [wiki](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki):

- [Recording a Session](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/Recording-a-Session): starting, pausing and ending a session
- [What It Records](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/What-It-Records): kills, damage, dice, scenes, and who gets the killing blow
- [Achievements](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/Achievements): one per character, every session
- [The Discord Text](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/The-Discord-Text): an example post
- [Posting to Discord](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/Posting-to-Discord): with the [Foundry VTT Discord integration](https://github.com/dxcufgb/FoundryVTT-discord-integration) bot, or your own
- [The Files](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/The-Files): the exported files and the JSON layout
- [Settings](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/Settings): the GM's options
- [API](https://github.com/dxcufgb/FoundryVTT-session-summary/wiki/API): for macros and other modules

## License

MIT
