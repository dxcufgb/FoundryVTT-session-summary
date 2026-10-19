/**
 * Dxcufgb's Session Summary (dxcufgbs-session-summary) - Foundry VTT V13, dnd5e 5.x
 *
 * Records a play session on the active GM's client: kills per character (killing blows), damage,
 * healing, characters dropping to 0 HP, fights, rests, distance walked, the scenes the party spent
 * time in, and every player's dice (GM rolls are not counted) (1s and max results per die type, natural 20s and 1s). When the
 * session ends, a summary is written to the Data folder (JSON for bots + Discord-ready Markdown).
 *
 * API: game.modules.get("dxcufgbs-session-summary").api
 *   .open()                        open the Session Summary window
 *   .start() / .end() / .pause(bool)
 *   .export()                      write the files now (returns { summary, files })
 *   .getSession()                  the raw recorded session
 *   .getSummary()                  the summary as it would be exported now
 *
 * Hook: "dxcufgbs-session-summary.exported" (summary, files) after files are written.
 */

import { MODULE_ID } from "./constants.js";
import * as state from "./state.js";
import { registerTrackers, restoreKills, notePresentParty } from "./trackers.js";
import { buildSummary } from "./summary.js";
import { startSession, endSession, pauseSession, exportNow, readyCheck } from "./flow.js";
import { SessionSummaryApp } from "./app.js";

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "session", {
    scope: "world", config: false, type: Object, default: null,
    onChange: value => state.adopt(value)
  });
  game.settings.register(MODULE_ID, "history", {
    scope: "world", config: false, type: Array, default: []
  });
  game.settings.register(MODULE_ID, "nextNumber", {
    name: "DXSS.Settings.NextNumber.Name", hint: "DXSS.Settings.NextNumber.Hint",
    scope: "world", config: true, type: Number, default: 1
  });
  game.settings.register(MODULE_ID, "autoStart", {
    name: "DXSS.Settings.AutoStart.Name", hint: "DXSS.Settings.AutoStart.Hint",
    scope: "world", config: true, type: String, default: "ask",
    choices: {
      ask: "DXSS.Settings.AutoStart.Ask",
      always: "DXSS.Settings.AutoStart.Always",
      never: "DXSS.Settings.AutoStart.Never"
    }
  });
  game.settings.register(MODULE_ID, "autoExport", {
    name: "DXSS.Settings.AutoExport.Name", hint: "DXSS.Settings.AutoExport.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "folder", {
    name: "DXSS.Settings.Folder.Name", hint: "DXSS.Settings.Folder.Hint",
    scope: "world", config: true, type: String, default: "session-summaries"
  });

  registerTrackers();
  state.onChange(() => SessionSummaryApp.refresh());

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      open: () => SessionSummaryApp.open(),
      start: startSession,
      end: (options) => endSession(options),
      pause: (paused = true) => pauseSession(paused),
      export: exportNow,
      getSession: () => state.getSession(),
      getSummary: () => {
        const session = state.getSession();
        return session ? buildSummary(session) : null;
      }
    };
  }
});

// Settings are GM-only: hide the section from players in Configure Settings.
Hooks.once("setup", () => {
  for (const setting of game.settings.settings.values()) {
    if (setting.namespace === MODULE_ID && setting.config) setting.config = game.user.isGM;
  }
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  state.load();
  restoreKills();
  if (!game.user.isActiveGM) return;
  if (state.isOpen() && game.scenes.active) state.setScene(game.scenes.active);
  notePresentParty();
  await readyCheck();
  ui.controls?.render();
});

/* -------------------------------------------- */
/*  Left menu (Token controls)                  */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if (!tokens?.tools || !game.user.isGM) return;
  const order = Math.max(0, ...Object.values(tokens.tools).map(t => t.order ?? 0));
  tokens.tools["dxss-summary"] = {
    name: "dxss-summary",
    order: order + 1,
    title: "DXSS.Control.Open",
    icon: "fa-solid fa-scroll",
    button: true,
    visible: true,
    onChange: () => SessionSummaryApp.open()
  };
});
