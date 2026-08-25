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
   * Consecutive changes sharing a key merge into one step while they keep arriving —
   * that is what makes typing a sentence one undo rather than thirty. A key is scoped to
   * what is being changed (`text:blockId`), so moving to another block starts a new step
   * even if the user keeps typing.
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
}

export type HistoryAction = CommitAction | StepAction | { type: "clear" };

export const initialHistory: HistoryState = { past: [], future: [], openAt: 0 };

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

    case "undo": {
      const entry = state.past[state.past.length - 1];
      if (!entry) return state;
      return {
        past: state.past.slice(0, -1),
        future: [{ ...entry, document: action.current }, ...state.future],
        // Stepping breaks the merge window: the next keystroke must start a fresh step
        // rather than fold into whatever the undo landed on.
        openKey: undefined,
        openAt: 0,
      };
    }

    case "redo": {
      const entry = state.future[0];
      if (!entry) return state;
      return {
        past: [...state.past, { ...entry, document: action.current }],
        future: state.future.slice(1),
        openKey: undefined,
        openAt: 0,
      };
    }

    case "clear":
      return initialHistory;
  }
}

export function undoLabel(state: HistoryState): string | null {
  return state.past[state.past.length - 1]?.label ?? null;
}

export function redoLabel(state: HistoryState): string | null {
  return state.future[0]?.label ?? null;
}

export function undoTarget(state: HistoryState): MailDocument | null {
  return state.past[state.past.length - 1]?.document ?? null;
}

export function redoTarget(state: HistoryState): MailDocument | null {
  return state.future[0]?.document ?? null;
}
