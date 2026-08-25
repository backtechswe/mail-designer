import { useCallback, useRef, useState } from "react";
import type { MailDocument } from "../types.js";

export interface HistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /**
   * Commit a new document. `coalesce` merges this change into the previous one when they
   * arrive within the coalesce window — that is what makes typing a sentence one undo step
   * instead of thirty.
   */
  commit: (next: MailDocument, coalesce?: boolean) => void;
}

export interface HistoryOptions {
  limit?: number;
  coalesceMs?: number;
}

/**
 * Undo/redo for a *controlled* document.
 *
 * MailDesigner takes `value` and `onChange`, so the document lives in the host app. Keeping
 * a second copy here would mean two sources of truth and a sync bug waiting to happen.
 * Instead only the past and future stacks live here; `value` is always the present.
 *
 * A consequence worth knowing: when the host replaces `value` itself — loading a template,
 * say — that is not an edit, and the stacks are cleared. Undo cannot walk back into a
 * different document.
 */
export function useHistory(
  value: MailDocument,
  onChange: (next: MailDocument) => void,
  options: HistoryOptions = {},
): HistoryControls {
  const limit = options.limit ?? 50;
  const coalesceMs = options.coalesceMs ?? 500;

  const [past, setPast] = useState<MailDocument[]>([]);
  const [future, setFuture] = useState<MailDocument[]>([]);

  // What we last handed to onChange. Anything else arriving as `value` came from outside.
  const emitted = useRef<MailDocument | null>(null);
  const lastCommitAt = useRef(0);
  const lastWasCoalescing = useRef(false);

  if (emitted.current !== null && emitted.current !== value) {
    // Detected during render rather than in an effect so the stale stacks are never
    // observable — an undo button must not be enabled for one frame against a document
    // this hook has never seen.
    emitted.current = null;
    lastCommitAt.current = 0;
    lastWasCoalescing.current = false;
    if (past.length > 0) setPast([]);
    if (future.length > 0) setFuture([]);
  }

  const commit = useCallback(
    (next: MailDocument, coalesce = false) => {
      const now = Date.now();
      const merge =
        coalesce && lastWasCoalescing.current && now - lastCommitAt.current < coalesceMs;

      if (!merge) {
        setPast((prev) => {
          const grown = [...prev, value];
          return grown.length > limit ? grown.slice(grown.length - limit) : grown;
        });
      }
      setFuture([]);
      lastCommitAt.current = now;
      lastWasCoalescing.current = coalesce;
      emitted.current = next;
      onChange(next);
    },
    [value, onChange, limit, coalesceMs],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1] as MailDocument;
    setPast(past.slice(0, -1));
    setFuture((prev) => [value, ...prev]);
    // Break coalescing: the next keystroke must start a fresh step, not merge into
    // whatever the undo landed on.
    lastWasCoalescing.current = false;
    emitted.current = previous;
    onChange(previous);
  }, [past, value, onChange]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0] as MailDocument;
    setFuture(future.slice(1));
    setPast((prev) => [...prev, value]);
    lastWasCoalescing.current = false;
    emitted.current = next;
    onChange(next);
  }, [future, value, onChange]);

  return { canUndo: past.length > 0, canRedo: future.length > 0, undo, redo, commit };
}
