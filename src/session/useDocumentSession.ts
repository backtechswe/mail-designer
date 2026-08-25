import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { MailDocument } from "../types.js";
import type { MailTemplateSummary, TemplateStore } from "../templates.js";
import {
  generateName,
  hasUnsavedWork,
  initialStatus,
  statusReducer,
} from "./status.js";
import type { SessionStatus } from "./status.js";

export interface DocumentSessionOptions {
  value: MailDocument;
  /** Loads a document without making it an undo step — see HistoryControls.load. */
  load: (next: MailDocument) => void;
  store?: TemplateStore | undefined;
  /** Open this document on mount. */
  initialId?: string | undefined;
  /** Quiet period after the last edit before writing. Default 1200 ms. */
  autosaveMs?: number;
  /** Name template for an unnamed draft, e.g. "Utkast {{date}}". */
  untitledTemplate: string;
  locale: string;
}

export interface DocumentSession {
  status: SessionStatus;
  hasUnsavedWork: boolean;
  /** Everything in the store, for the switcher. Refreshed on open and after each save. */
  documents: MailTemplateSummary[];
  refresh: () => Promise<void>;
  rename: (name: string) => void;
  saveNow: () => Promise<void>;
  open: (id: string) => Promise<void>;
  /** Starts a fresh document. Nothing is written until the first edit. */
  startNew: (next: MailDocument) => void;
  remove: (id: string) => Promise<void>;
}

/**
 * Which document is open, whether it is saved, and how to move between documents.
 *
 * Two rules shape this.
 *
 * The record is created on the **first edit**, not on load — so there is something to save
 * changes against the moment the user starts working, without littering the store with empty
 * drafts every time the editor is opened.
 *
 * Switching documents goes through `load`, which clears the undo history rather than
 * recording a step. Undoing across a switch would pull the previous document's content into
 * the new record, and autosave would then write it there.
 */
export function useDocumentSession({
  value,
  load,
  store,
  initialId,
  autosaveMs = 1200,
  untitledTemplate,
  locale,
}: DocumentSessionOptions): DocumentSession {
  const [status, dispatch] = useReducer(
    statusReducer,
    undefined,
    () => initialStatus(generateName(untitledTemplate, new Date(), locale)),
  );
  const [documents, setDocuments] = useState<MailTemplateSummary[]>([]);

  // The document as the session last saw it. Anything else means the user edited.
  const known = useRef(value);
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  // Read inside the debounced save, so it always writes the newest document rather than the
  // one that existed when the timer was set.
  const latest = useRef({ value, status });
  latest.current = { value, status };

  const refresh = useCallback(async () => {
    if (!store) return;
    try {
      setDocuments(await store.list());
    } catch {
      // A failed listing is not worth interrupting editing over; the switcher just stays
      // as it was and the save status still reports real problems.
    }
  }, [store]);

  const write = useCallback(async () => {
    if (!store || inFlight.current) return;
    const { value: document, status: current } = latest.current;
    inFlight.current = true;
    dispatch({ type: "saveStarted" });
    try {
      const saved = await store.save({
        ...(current.id ? { id: current.id } : {}),
        name: current.name,
        document,
      });
      dispatch({
        type: "saveSucceeded",
        id: saved.id,
        name: saved.name,
        at: saved.updatedAt ?? new Date().toISOString(),
      });
      void refresh();
    } catch (error) {
      dispatch({
        type: "saveFailed",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.current = false;
    }
  }, [store, refresh]);

  const schedule = useCallback(() => {
    if (!store) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void write();
    }, autosaveMs);
  }, [store, write, autosaveMs]);

  // Detect edits. Comparing identity is enough: every mutation produces a new document
  // object, and a load records the new one here first so it is not mistaken for an edit.
  useEffect(() => {
    if (known.current === value) return;
    known.current = value;
    dispatch({ type: "edited" });
    schedule();
  }, [value, schedule]);

  // A save owed because an edit landed mid-flight.
  useEffect(() => {
    if (status.pending && status.state !== "saving") schedule();
  }, [status.pending, status.state, schedule]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const openById = useCallback(
    async (id: string) => {
      if (!store) return;
      const template = await store.load(id);
      if (!template) throw new Error("not-found");
      known.current = template.document;
      load(template.document);
      dispatch({
        type: "opened",
        id: template.id,
        name: template.name,
        savedAt: template.updatedAt,
      });
    },
    [store, load],
  );

  // Open the requested document once, on mount.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !initialId || !store) return;
    opened.current = true;
    void openById(initialId).catch(() => {
      /* a missing document leaves the editor on whatever it was given */
    });
  }, [initialId, store, openById]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo<DocumentSession>(
    () => ({
      status,
      hasUnsavedWork: hasUnsavedWork(status),
      documents,
      refresh,
      rename: (name) => {
        dispatch({ type: "renamed", name });
        schedule();
      },
      saveNow: async () => {
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
          timer.current = null;
        }
        await write();
      },
      open: openById,
      startNew: (next) => {
        known.current = next;
        load(next);
        dispatch({
          type: "opened",
          id: null,
          name: generateName(untitledTemplate, new Date(), locale),
        });
      },
      remove: async (id) => {
        if (!store?.remove) return;
        await store.remove(id);
        await refresh();
        // Removing the open document leaves the content on screen but detached from the
        // store; the next edit writes it back as a new record rather than silently failing.
        if (status.id === id) {
          dispatch({
            type: "opened",
            id: null,
            name: generateName(untitledTemplate, new Date(), locale),
          });
        }
      },
    }),
    [status, documents, refresh, schedule, write, openById, load, store, untitledTemplate, locale],
  );
}
