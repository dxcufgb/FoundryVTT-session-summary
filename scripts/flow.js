/**
 * Starting, pausing, ending, exporting and discarding a session (with the GM prompts).
 */

import { MODULE_ID } from "./constants.js";
import * as state from "./state.js";
import { restoreKills, notePresentParty } from "./trackers.js";
import { exportSession, downloadSession } from "./export.js";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const Dialog = () => foundry.applications.api.DialogV2;

/** Long idle time after which the GM is asked whether the open session is still the same one. */
const STALE_MS = 6 * 60 * 60 * 1000;

function requireActiveGM() {
  if (game.user.isActiveGM) return true;
  ui.notifications.warn(F("DXSS.Notify.NotActiveGM", { name: game.users.activeGM?.name ?? "—" }));
  return false;
}

export async function startSession() {
  if (!requireActiveGM() || state.isOpen()) return false;
  await state.start();
  restoreKills();
  notePresentParty();
  ui.notifications.info(F("DXSS.Notify.Started", { n: state.getSession().number }));
  return true;
}

export async function pauseSession(paused) {
  if (!requireActiveGM()) return;
  await state.setPaused(paused);
  ui.notifications.info(paused ? "DXSS.Notify.Paused" : "DXSS.Notify.Resumed", { localize: true });
}

/**
 * End the session (asks first) and export it if "Export when the session ends" is on.
 * Returns false when nothing was ended, otherwise { ended: true, exported } where `exported` is
 * true / false (written / failed) or null (automatic export is off).
 */
export async function endSession({ confirm = true } = {}) {
  if (!requireActiveGM() || !state.isOpen()) return false;
  if (confirm) {
    const ok = await Dialog().confirm({
      window: { title: "DXSS.Dialog.End.Title", icon: "fa-solid fa-flag-checkered" },
      content: `<p>${F("DXSS.Dialog.End.Content", { n: state.getSession().number })}</p>`
    });
    if (!ok) return false;
  }
  await state.end();
  ui.notifications.info(F("DXSS.Notify.Ended", { n: state.getSession().number }));
  const exported = game.settings.get(MODULE_ID, "autoExport") ? !!(await exportNow()) : null;
  return { ended: true, exported };
}

/* -------------------------------------------- */
/*  Return to Setup                             */
/* -------------------------------------------- */

/**
 * "Return to Setup" (the Settings sidebar button and the main menu entry) both call
 * game.shutDown(). Wrap it: when the active GM leaves while a session is open, ask whether to end
 * the session first, so its summary is written before the world closes.
 */
export function guardReturnToSetup() {
  const original = game.shutDown;
  if (typeof original !== "function" || original.dxssGuarded) return;
  const guarded = async function (...args) {
    let leave = true;
    try {
      leave = await confirmLeaving();
    } catch (err) {
      console.error(`${MODULE_ID} | return-to-setup reminder failed`, err); // never block leaving because of us
    }
    if (!leave) return;
    return original.apply(this, args);
  };
  guarded.dxssGuarded = true;
  game.shutDown = guarded;
}

/** Ask about the open session. Resolves to true to go on to setup, false to stay in the world. */
async function confirmLeaving() {
  if (!game.settings.get(MODULE_ID, "setupReminder")) return true;
  if (!game.user.isActiveGM || !state.isOpen()) return true;
  const session = state.getSession();
  const autoExport = game.settings.get(MODULE_ID, "autoExport");
  const content = autoExport ? "DXSS.Dialog.Setup.Content" : "DXSS.Dialog.Setup.ContentNoExport";
  const choice = await Dialog().wait({
    window: { title: "DXSS.Dialog.Setup.Title", icon: "fa-solid fa-scroll" },
    content: `<p>${F(content, { n: session.number })}</p><p class="hint">${L("DXSS.Dialog.Setup.Hint")}</p>`,
    buttons: [
      { action: "end", label: "DXSS.Dialog.Setup.End", icon: "fa-solid fa-flag-checkered", default: true },
      { action: "keep", label: "DXSS.Dialog.Setup.Keep", icon: "fa-solid fa-door-open" },
      { action: "stay", label: "DXSS.Dialog.Setup.Stay", icon: "fa-solid fa-xmark" }
    ]
  }); // closing the dialog resolves to null; an error goes to the caller, which lets the GM leave
  if (choice === "keep") return true;
  if (choice !== "end") return false; // "Stay" or the dialog was closed
  const result = await endSession({ confirm: false });
  if (result?.exported === false) {
    // The session is ended and saved in the world, but its files are missing: don't leave yet.
    ui.notifications.error(L("DXSS.Notify.ExportFailedStay"), { permanent: true });
    return false;
  }
  return true;
}

/** Write the summary to the Data folder. */
export async function exportNow() {
  const session = state.getSession();
  if (!session) return null;
  if (!game.user.isGM) return null;
  try {
    if (state.isOpen()) state.tick();
    const result = await exportSession(session);
    ui.notifications.info(F("DXSS.Notify.Exported", { path: `Data/${result.files[0]}` }));
    return result;
  } catch (err) {
    console.error(`${MODULE_ID} | export failed`, err);
    ui.notifications.error(F("DXSS.Notify.ExportFailed", { error: err?.message ?? err }));
    return null;
  }
}

export function downloadNow(format) {
  const session = state.getSession();
  if (session) downloadSession(session, format);
}

/** Forget the session without exporting it (asks first). */
export async function discardSession() {
  if (!requireActiveGM() || !state.getSession()) return false;
  const ok = await Dialog().confirm({
    window: { title: "DXSS.Dialog.Discard.Title", icon: "fa-solid fa-trash" },
    content: `<p>${L("DXSS.Dialog.Discard.Content")}</p>`
  });
  if (!ok) return false;
  await state.discard();
  restoreKills();
  return true;
}

/**
 * When the active GM logs in: continue an open session (asking if it has been idle for hours),
 * or start a new one depending on the "Start recording" setting.
 */
export async function readyCheck() {
  if (!game.user.isActiveGM) return;
  const session = state.getSession();
  const mode = game.settings.get(MODULE_ID, "autoStart");

  if (session && !session.endedAt) {
    const idle = Date.now() - (session.lastSeen ?? 0);
    if (idle < STALE_MS) {
      ui.notifications.info(F("DXSS.Notify.Continuing", { n: session.number }));
      return;
    }
    const since = new Date(session.lastSeen).toLocaleString(game.i18n.lang || "en", { dateStyle: "medium", timeStyle: "short" });
    const choice = await Dialog().wait({
      window: { title: "DXSS.Dialog.Stale.Title", icon: "fa-solid fa-scroll" },
      content: `<p>${F("DXSS.Dialog.Stale.Content", { n: session.number, since: esc(since) })}</p>`,
      buttons: [
        { action: "new", label: "DXSS.Dialog.Stale.EndNew", icon: "fa-solid fa-flag-checkered", default: true },
        { action: "continue", label: "DXSS.Dialog.Stale.Continue", icon: "fa-solid fa-play" },
        { action: "later", label: "DXSS.Dialog.Stale.Later", icon: "fa-solid fa-clock" }
      ]
    }).catch(() => null);
    if (choice === "new") {
      await endSession({ confirm: false });
      await startSession();
    }
    return;
  }

  if (mode === "always") return startSession();
  if (mode !== "ask") return;
  const ok = await Dialog().confirm({
    window: { title: "DXSS.Dialog.Start.Title", icon: "fa-solid fa-scroll" },
    content: `<p>${F("DXSS.Dialog.Start.Content", { n: game.settings.get(MODULE_ID, "nextNumber") })}</p>`
  }).catch(() => false);
  if (ok) await startSession();
}
