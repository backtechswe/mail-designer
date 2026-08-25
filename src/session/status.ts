/**
 * The save-state machine, kept pure so its transitions can be tested.
 *
 * Autosave means the window in which work is genuinely unsaved is short — but it is not
 * zero, and the interesting states are the unhappy ones: a save that failed, a save in
 * flight when the user edits again, a document that has never been written at all. Those are
 * what the prompts and the status line are actually about.
 */

export type SaveState = "new" | "clean" | "dirty" | "saving" | "error";

export interface SessionStatus {
  state: SaveState;
  /** Set once the document exists in the store. */
  id: string | null;
  name: string;
  /** ISO timestamp of the last successful save. */
  savedAt?: string | undefined;
  error?: string | undefined;
  /** An edit arrived while a save was in flight, so another one is owed. */
  pending: boolean;
}

export type SessionEvent =
  | { type: "edited" }
  | { type: "saveStarted" }
  | { type: "saveSucceeded"; id: string; name: string; at: string }
  | { type: "saveFailed"; error: string }
  | { type: "opened"; id: string | null; name: string; savedAt?: string | undefined }
  | { type: "renamed"; name: string };

export function initialStatus(name: string): SessionStatus {
  return { state: "new", id: null, name, pending: false };
}

/**
 * `pending` is the part worth reading twice. A save takes time; if the user types during it,
 * the write already in flight is stale. Rather than cancelling it we let it finish and
 * remember that another is owed, so the store never receives out-of-order writes.
 */
export function statusReducer(status: SessionStatus, event: SessionEvent): SessionStatus {
  switch (event.type) {
    case "edited":
      if (status.state === "saving") return { ...status, pending: true };
      return { ...status, state: "dirty", error: undefined };

    case "saveStarted":
      return { ...status, state: "saving", pending: false, error: undefined };

    case "saveSucceeded":
      return {
        ...status,
        // An edit that landed mid-flight leaves the document dirty again, not clean.
        state: status.pending ? "dirty" : "clean",
        id: event.id,
        name: event.name,
        savedAt: event.at,
        error: undefined,
      };

    case "saveFailed":
      // Stay dirty: the work still needs writing, and the error is what the user acts on.
      return { ...status, state: "error", error: event.error, pending: false };

    case "opened":
      return {
        state: event.id ? "clean" : "new",
        id: event.id,
        name: event.name,
        savedAt: event.savedAt,
        pending: false,
      };

    case "renamed":
      return { ...status, name: event.name, state: status.state === "clean" ? "dirty" : status.state };
  }
}

/** Whether there is work the store has not accepted yet. Drives every "are you sure". */
export function hasUnsavedWork(status: SessionStatus): boolean {
  return status.state === "dirty" || status.state === "saving" || status.state === "error";
}

/**
 * Name for a document the user has not named. Dated rather than "Untitled 1": a list of
 * drafts is only useful if you can tell them apart, and the day and time is the one thing
 * that always differs.
 */
export function generateName(template: string, now: Date, locale: string): string {
  const date = now.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return template.replace("{{date}}", date);
}
