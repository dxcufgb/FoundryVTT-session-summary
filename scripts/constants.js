export const MODULE_ID = "dxcufgbs-session-summary";

/** Version of the exported JSON layout. Bump when a field is renamed or removed. */
export const SCHEMA_VERSION = 1;

/** How often the clock ticks (session length and time per scene). */
export const TICK_MS = 15_000;

/** A gap longer than this between ticks means Foundry was closed: the gap is not counted. */
export const MAX_GAP_MS = 120_000;

/** How often unsaved changes are written to the world. */
export const SAVE_MS = 20_000;

/** A hit (attack / damage roll / midi damage card) counts towards a kill for this long. */
export const HIT_MEMORY_MS = 60_000;

/** Wait this long after HP changes before deciding who did it (midi's damage card can come a moment later). */
export const SETTLE_MS = 1_500;

/** An enemy healed back above 0 HP within this time after its "death" was an undo: the kill is removed. */
export const UNDO_KILL_MS = 120_000;

/** How many messages' processed rolls are remembered (so merged midi cards aren't counted twice). */
export const SEEN_MESSAGES = 300;

/** Discord's message length limit. */
export const DISCORD_LIMIT = 2000;

/** Roll categories used for natural 20s and 1s. */
export const D20_CATEGORIES = ["attack", "save", "check", "death", "initiative", "other"];
