/**
 * Session Summary window (GM only): start / pause / end the session, live stats, title and GM
 * notes, Discord preview, export.
 */

import { MODULE_ID } from "./constants.js";
import { getSession, isOpen, onChange, markDirty } from "./state.js";
import { buildSummary, formatDuration } from "./summary.js";
import { exportFolder } from "./export.js";
import { startSession, endSession, pauseSession, discardSession, exportNow, downloadNow } from "./flow.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = key => game.i18n.localize(key);

export class SessionSummaryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dxss-window",
    classes: ["dxss-window"],
    tag: "div",
    window: { title: "DXSS.Title", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 780, height: 760 },
    actions: {
      start: SessionSummaryApp.#onStart,
      pause: SessionSummaryApp.#onPause,
      resume: SessionSummaryApp.#onResume,
      end: SessionSummaryApp.#onEnd,
      export: SessionSummaryApp.#onExport,
      downloadJson: SessionSummaryApp.#onDownloadJson,
      downloadMd: SessionSummaryApp.#onDownloadMd,
      discard: SessionSummaryApp.#onDiscard,
      copy: SessionSummaryApp.#onCopy
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/session-window.hbs`, scrollable: [".dxss-body"] }
  };

  static #instance = null;

  static open() {
    this.#instance ??= new this();
    return this.#instance.render({ force: true });
  }

  /** Re-render the open window (throttled). */
  static refresh = foundry.utils.throttle(() => {
    const app = SessionSummaryApp.#instance;
    if (app?.rendered && !app.element?.contains(document.activeElement)) app.render();
  }, 2000);

  #unsubscribe = null;
  #clock = null;

  /* -------------------------------------------- */

  async _prepareContext() {
    const session = getSession();
    const ctx = {
      isActiveGM: game.user.isActiveGM,
      activeGM: game.users.activeGM?.name ?? "—",
      folder: exportFolder(),
      hasSession: !!session,
      nextNumber: game.settings.get(MODULE_ID, "nextNumber")
    };
    if (!session) return ctx;

    const summary = buildSummary(session);
    const state = session.endedAt ? "ended" : session.paused ? "paused" : "recording";
    const fmtNum = n => Number(n ?? 0).toLocaleString(game.i18n.lang || "en");
    return Object.assign(ctx, {
      session,
      summary,
      state,
      stateLabel: L(`DXSS.State.${state}`),
      open: isOpen(),
      paused: !!session.paused,
      duration: formatDuration(session.activeMs),
      started: new Date(session.startedAt).toLocaleString(game.i18n.lang || "en", { dateStyle: "medium", timeStyle: "short" }),
      currentScene: session.scenes[session.currentScene]?.name ?? null,
      tiles: [
        { icon: "fa-solid fa-skull", label: L("DXSS.Tile.Kills"), value: summary.totals.kills },
        { icon: "fa-solid fa-shield-halved", label: L("DXSS.Tile.Combats"), value: summary.totals.combats },
        { icon: "fa-solid fa-rotate", label: L("DXSS.Tile.Rounds"), value: summary.totals.rounds },
        { icon: "fa-solid fa-dice-d20", label: L("DXSS.Tile.Nat20"), value: summary.totals.nat20, cls: "good" },
        { icon: "fa-solid fa-face-dizzy", label: L("DXSS.Tile.Nat1"), value: summary.totals.nat1, cls: "bad" },
        { icon: "fa-solid fa-map", label: L("DXSS.Tile.Scenes"), value: summary.totals.scenes }
      ],
      characters: summary.characters.map(c => ({
        ...c,
        damageDealt: fmtNum(c.damageDealt), damageTaken: fmtNum(c.damageTaken),
        healingDone: fmtNum(c.healingDone), distance: c.distance ? `${fmtNum(c.distance)} ${c.units}` : "–"
      })),
      players: summary.players.filter(p => p.rolls > 0).map(p => ({
        ...p,
        label: p.characters.length ? `${p.characters.join(", ")} (${p.name})` : p.name,
        diceList: Object.entries(p.dice).map(([die, d]) => ({ die, ...d }))
      })),
      scenes: summary.scenes.map(s => ({ ...s, time: formatDuration(s.minutes * 60_000), current: s.id === session.currentScene })),
      kills: summary.kills.slice(-12).reverse().map(k => ({
        ...k,
        time: new Date(k.at).toLocaleTimeString(game.i18n.lang || "en", { hour: "2-digit", minute: "2-digit" }),
        byLabel: k.by ?? k.killer ?? L("DXSS.Unattributed")
      })),
      achievements: summary.achievements,
      markdown: summary.markdown,
      markdownLength: summary.markdown.length
    });
  }

  /* -------------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#unsubscribe ??= onChange(() => SessionSummaryApp.refresh());
    this.#clock ??= setInterval(() => SessionSummaryApp.refresh(), 15_000);

    for (const field of this.element.querySelectorAll("[data-field]")) {
      field.addEventListener("change", event => {
        const session = getSession();
        if (!session || !game.user.isActiveGM) return;
        session[event.currentTarget.dataset.field] = event.currentTarget.value;
        markDirty();
      });
    }
  }

  _onClose(options) {
    super._onClose?.(options);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    clearInterval(this.#clock);
    this.#clock = null;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Save a title / notes field that still has focus before acting. */
  #commitFields() {
    const session = getSession();
    if (!session) return;
    for (const field of this.element.querySelectorAll("[data-field]")) session[field.dataset.field] = field.value;
    markDirty();
  }

  static async #onStart() { await startSession(); this.render(); }
  static async #onPause() { await pauseSession(true); this.render(); }
  static async #onResume() { await pauseSession(false); this.render(); }

  static async #onEnd() {
    this.#commitFields();
    await endSession();
    this.render();
  }

  static async #onExport() {
    this.#commitFields();
    await exportNow();
    this.render();
  }

  static #onDownloadJson() { this.#commitFields(); downloadNow("json"); }
  static #onDownloadMd() { this.#commitFields(); downloadNow("md"); }

  static async #onDiscard() {
    if (await discardSession()) this.render();
  }

  static async #onCopy() {
    const text = this.element.querySelector(".dxss-preview")?.textContent ?? "";
    await game.clipboard.copyPlainText(text);
    ui.notifications.info("DXSS.Notify.Copied", { localize: true });
  }
}
