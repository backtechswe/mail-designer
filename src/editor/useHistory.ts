import { useCallback, useMemo, useReducer, useRef } from "react";
import type { MailDocument } from "../types.js";
import {
  DEFAULT_RUN_TIMEOUT_MS,
  historyReducer,
  initialHistory,
  recentSteps,
  redoLabel,
  redoTarget,
  undoLabel,
  undoTarget,
} from "./history.js";
import type { HistoryStep } from "./history.js";

export interface CommitOptions {
  /** Names the change for the undo button. */
  label: string;
  /** Consecutive changes sharing a key merge into one step. See history.ts. */
  coalesceKey?: string;
}

export interface HistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  /** What undo would reverse, and what redo would reapply. Null when unavailable. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** How many steps are stored, so a host can show the depth if it wants to. */
  depth: number;
  /** The recent steps in each direction, nearest first — what the history menus list. */
  undoSteps: HistoryStep[];
  redoSteps: HistoryStep[];
  /** `count` steps at once, for jumping to a point in the menu. Defaults to one. */
  undo: (count?: number) => void;
  redo: (count?: number) => void;
  commit: (next: MailDocument, options: CommitOptions) => void;
  /**
   * End the current merge run. The next change becomes its own step even if it shares a
   * key and arrives inside the time window — what should happen when focus leaves a field.
   */
  breakRun: () => void;
  /**
   * Swap in a different document and forget the history.
   *
   * Not the same thing as `commit`, and the difference matters. Applying a template edits
   * the document you are on, so it belongs in the history. *Switching* to another document
   * must not: undoing across a switch would pull the previous document's content into the
   * new record, and autosave would then write it there. So the stacks are cleared instead.
   */
  load: (next: MailDocument) => void;
}

export interface HistoryOptions {
  limit?: number;
  /** Backstop only — see DEFAULT_RUN_TIMEOUT_MS. Runs normally end on a real event. */
  coalesceMs?: number;
  /** Label used when the host swaps the document out from under the editor. */
  externalLabel?: string;
}

/**
 * Undo/redo for a *controlled* document.
 *
 * MailDesigner takes `value` and `onChange`, so the document lives in the host app. Keeping
 * a second copy here would mean two sources of truth and a sync bug waiting to happen; only
 * the past and future stacks live here, and `value` is always the present.
 *
 * A document that arrives from outside — the host loading a template from its own chrome —
 * is recorded as a step rather than clearing the stacks. It is a change the user caused, so
 * undo should reverse it like any other.
 */
export function useHistory(
  value: MailDocument,
  onChange: (next: MailDocument) => void,
  options: HistoryOptions = {},
): HistoryControls {
  const limit = options.limit ?? 200;
  const coalesceMs = options.coalesceMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const externalLabel = options.externalLabel ?? "";

  const [state, dispatch] = useReducer(historyReducer, initialHistory);

  // The last document this hook handed to onChange. Anything else arriving as `value` came
  // from the host.
  const emitted = useRef<MailDocument | null>(null);
  const previous = useRef(value);

  if (emitted.current !== value && previous.current !== value) {
    // Detected during render so the stacks are never observably stale — an undo button must
    // not point at a document that has already been replaced.
    dispatch({
      type: "commit",
      previous: previous.current,
      label: externalLabel,
      at: Date.now(),
      limit,
      coalesceMs,
    });
    emitted.current = value;
  }
  previous.current = value;

  const commit = useCallback(
    (next: MailDocument, { label, coalesceKey }: CommitOptions) => {
      dispatch({
        type: "commit",
        previous: value,
        label,
        coalesceKey,
        at: Date.now(),
        limit,
        coalesceMs,
      });
      emitted.current = next;
      previous.current = next;
      onChange(next);
    },
    [value, onChange, limit, coalesceMs],
  );

  const breakRun = useCallback(() => dispatch({ type: "break" }), []);

  const load = useCallback(
    (next: MailDocument) => {
      dispatch({ type: "clear" });
      emitted.current = next;
      previous.current = next;
      onChange(next);
    },
    [onChange],
  );

  const step = useCallback(
    (direction: "undo" | "redo", requested: unknown) => {
      // `onClick={history.undo}` is the obvious thing for a host to write, and it would hand
      // us a MouseEvent. Anything that is not a sensible count means one step.
      const count =
        typeof requested === "number" && Number.isFinite(requested) && requested >= 1
          ? Math.floor(requested)
          : 1;
      const target =
        direction === "undo" ? undoTarget(state, count) : redoTarget(state, count);
      if (!target) return;
      dispatch({ type: direction, current: value, count });
      emitted.current = target;
      previous.current = target;
      onChange(target);
    },
    [state, value, onChange],
  );

  return useMemo<HistoryControls>(
    () => ({
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undoLabel: undoLabel(state),
      redoLabel: redoLabel(state),
      depth: state.past.length,
      undoSteps: recentSteps(state, "undo"),
      redoSteps: recentSteps(state, "redo"),
      undo: (count) => step("undo", count),
      redo: (count) => step("redo", count),
      commit,
      breakRun,
      load,
    }),
    [state, step, commit, breakRun, load],
  );
}
