import type { MailDocument } from "../types.js";

/**
 * The history state machine, as a pure reducer.
 *
 * Kept free of React so it can be tested directly: undo/redo is exactly the kind of logic
 * that looks obviously correct and then loses a step at a boundary, and clicking buttons in
 * a browser is a poor way to find that out.
 */

export interface HistoryEntry {
  /** The document as it was *before* the change this entry describes. */
  document: MailDocument;
  /** What the change was, for the undo button's label. */
  label: string;
  /**
   * Consecutive changes sharing a key merge into one step — that is what makes typing a
   * sentence one undo rather than thirty. A key is scoped to what is being changed
   * (`update:blockId:fontSize`), so touching anything else starts a new step.
   */
  coalesceKey?: string | undefined;
  at: number;
}

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Set while the last commit is still open for merging. */
  openKey?: string | undefined;
  openAt: number;
}

export interface CommitAction {
  type: "commit";
  /** The document being replaced — the reducer never sees the new one. */
  previous: MailDocument;
  label: string;
  coalesceKey?: string | undefined;
  at: number;
  limit: number;
  coalesceMs: number;
}

export interface StepAction {
  type: "undo" | "redo";
  /** The document currently on screen, which moves to the opposite stack. */
  current: MailDocument;
  /**
   * How many steps to take. More than one when the user picks a point out of the history
   * menu rather than clicking the button repeatedly. Clamped to what the stack holds.
   */
  count?: number;
}

export type HistoryAction =
  | CommitAction
  | StepAction
  | { type: "break" }
  | { type: "clear" };

export const initialHistory: HistoryState = { past: [], future: [], openAt: 0 };

/**
 * How long a merge run may stay open on time alone.
 *
 * Generous on purpose. Time started out as the *primary* criterion with a 600 ms window, and
 * that was wrong: on a document heavy enough that a render takes a few hundred milliseconds,
 * the browser delays the next input event, so two consecutive keystrokes arrived a full
 * second apart and every digit became its own undo step. Undoing a font size then landed on
 * a half-typed number.
 *
 * Runs are closed by real events instead — leaving the field, selecting another block,
 * touching a different property, undoing. This is only a backstop for a run that no such
 * event ever closes.
 */
export const DEFAULT_RUN_TIMEOUT_MS = 30_000;

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit": {
      const { previous, label, coalesceKey, at, limit, coalesceMs } = action;
      const merges =
        coalesceKey !== undefined &&
        state.openKey === coalesceKey &&
        state.past.length > 0 &&
        at - state.openAt < coalesceMs;

      if (merges) {
        // Keep the older snapshot: undoing should land before the whole burst, not in the
        // middle of it. Only the timestamp moves, so a continuous burst keeps merging.
        return { ...state, future: [], openAt: at };
      }

      const entry: HistoryEntry = { document: previous, label, coalesceKey, at };
      const past = [...state.past, entry];
      return {
        past: past.length > limit ? past.slice(past.length - limit) : past,
        future: [],
        openKey: coalesceKey,
        openAt: at,
      };
    }

    // Both directions take N steps by repeating the single step, rather than by slicing the
    // stacks in one go. Each hop has to know the document it is leaving behind, since that is
    // what the opposite stack records — and getting that right once beats getting it right
    // twice.
    case "undo":
    case "redo": {
      let next = state;
      let current = action.current;
      const count = Math.max(1, Math.min(action.count ?? 1, stackFor(state, action.type).length));
      for (let i = 0; i < count; i += 1) {
        const stepped = stepOnce(next, action.type, current);
        if (!stepped) break;
        next = stepped.state;
        current = stepped.landedOn;
      }
      return next;
    }

    case "break":
      // Ends the merge run without recording anything, so the next change starts a fresh
      // step. Used when focus leaves a field: continuing to type in it later is a new edit.
      return state.openKey === undefined ? state : { ...state, openKey: undefined, openAt: 0 };

    case "clear":
      return initialHistory;
  }
}

function stackFor(state: HistoryState, direction: "undo" | "redo"): HistoryEntry[] {
  return direction === "undo" ? state.past : state.future;
}

/** One hop, and the document it lands on — which the next hop leaves behind in its turn. */
function stepOnce(
  state: HistoryState,
  direction: "undo" | "redo",
  current: MailDocument,
): { state: HistoryState; landedOn: MailDocument } | null {
  if (direction === "undo") {
    const entry = state.past[state.past.length - 1];
    if (!entry) return null;
    return {
      state: {
        past: state.past.slice(0, -1),
        future: [{ ...entry, document: current }, ...state.future],
        // Stepping breaks the merge window: the next keystroke must start a fresh step
        // rather than fold into whatever the undo landed on.
        openKey: undefined,
        openAt: 0,
      },
      landedOn: entry.document,
    };
  }

  const entry = state.future[0];
  if (!entry) return null;
  return {
    state: {
      past: [...state.past, { ...entry, document: current }],
      future: state.future.slice(1),
      openKey: undefined,
      openAt: 0,
    },
    landedOn: entry.document,
  };
}

/** One line in the history menu: what the step was, and how far back it is. */
export interface HistoryStep {
  label: string;
  /** Steps to take to land here — 1 is what the button alone would do. */
  steps: number;
  at: number;
}

/**
 * The most recent steps in either direction, nearest first.
 *
 * Nearest first because the menu is read from the button downwards: the first line is what
 * one click would do, and every line below it is that plus more.
 */
export function recentSteps(
  state: HistoryState,
  direction: "undo" | "redo",
  max = 10,
): HistoryStep[] {
  const stack = stackFor(state, direction);
  const ordered = direction === "undo" ? [...stack].reverse() : stack;
  return ordered.slice(0, max).map((entry, index) => ({
    label: entry.label,
    steps: index + 1,
    at: entry.at,
  }));
}

export function undoLabel(state: HistoryState): string | null {
  return state.past[state.past.length - 1]?.label ?? null;
}

export function redoLabel(state: HistoryState): string | null {
  return state.future[0]?.label ?? null;
}

/** The document `count` undos would land on. */
export function undoTarget(state: HistoryState, count = 1): MailDocument | null {
  return state.past[state.past.length - count]?.document ?? null;
}

/** The document `count` redos would land on. */
export function redoTarget(state: HistoryState, count = 1): MailDocument | null {
  return state.future[count - 1]?.document ?? null;
}
