/**
 * Writes the summary into Foundry's Data folder (by default Data/session-summaries/), where a bot
 * on the same machine can read it:
 *
 *   session-014_2026-10-19.json   the full summary (see README for the layout)
 *   session-014_2026-10-19.md     the Discord-ready text (≤ 2000 characters)
 *   latest.json / latest.md       copies of the newest export
 *   index.json                    every exported session of this world
 */

import { MODULE_ID } from "./constants.js";
import { buildSummary } from "./summary.js";

const FilePicker = () => foundry.applications.apps.FilePicker.implementation;

export function exportFolder() {
  return String(game.settings.get(MODULE_ID, "folder") || "session-summaries").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function baseName(session) {
  const d = new Date(session.startedAt);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `session-${String(session.number).padStart(3, "0")}_${date}`;
}

/** Create every missing folder of a Data path. */
async function ensureFolder(path) {
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    try {
      await FilePicker().browse("data", current);
    } catch {
      try { await FilePicker().createDirectory("data", current); } catch (err) {
        if (!String(err?.message ?? err).includes("EEXIST")) throw err;
      }
    }
  }
}

async function upload(folder, name, text, type) {
  const file = new File([text], name, { type });
  const result = await FilePicker().upload("data", folder, file, {}, { notify: false });
  if (!result || result.status === "error") throw new Error(result?.message ?? `Could not write ${folder}/${name}`);
  return `${folder}/${name}`;
}

/**
 * Build the summary and write it to the Data folder.
 * @returns {Promise<{summary: object, files: string[]}>}
 */
export async function exportSession(session) {
  const summary = buildSummary(session);
  const folder = exportFolder();
  const base = baseName(session);
  const json = JSON.stringify(summary, null, 2);
  const md = summary.markdown;

  await ensureFolder(folder);
  const files = [
    await upload(folder, `${base}.json`, json, "application/json"),
    await upload(folder, `${base}.md`, md, "text/markdown"),
    await upload(folder, "latest.json", json, "application/json"),
    await upload(folder, "latest.md", md, "text/markdown")
  ];

  // index.json: every exported session of this world, newest first
  const history = (game.settings.get(MODULE_ID, "history") ?? []).filter(h => h.id !== session.id);
  history.unshift({
    id: session.id,
    number: session.number,
    title: session.title || null,
    startedAt: summary.session.startedAt,
    endedAt: summary.session.endedAt,
    durationMinutes: summary.session.durationMinutes,
    kills: summary.totals.kills,
    json: `${base}.json`,
    md: `${base}.md`
  });
  await game.settings.set(MODULE_ID, "history", history);
  const index = { schema: summary.schema, world: summary.session.world, updatedAt: new Date().toISOString(), sessions: history };
  files.push(await upload(folder, "index.json", JSON.stringify(index, null, 2), "application/json"));

  Hooks.callAll(`${MODULE_ID}.exported`, summary, files);
  return { summary, files };
}

/** Download the summary to this computer (no Data folder involved). */
export function downloadSession(session, format = "json") {
  const summary = buildSummary(session);
  const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
  if (format === "md") save(summary.markdown, "text/markdown", `${baseName(session)}.md`);
  else save(JSON.stringify(summary, null, 2), "application/json", `${baseName(session)}.json`);
}
