import type { MailDocument } from "./types.js";
import { coerceDocument, validateDocument } from "./validate.js";

/**
 * Template storage.
 *
 * This package deliberately ships **no database**. A template is a name plus a JSON
 * document, and every app already has somewhere to put that — Firestore, SQL Server, a
 * REST API, a file. So the package defines the contract and provides the adapters that
 * need no dependencies; anything that needs a client library is a ten-line adapter in the
 * host app, documented in docs/templates.md.
 *
 * The contract is intentionally tiny. `list`, `load` and `save` are required; `remove` and
 * `rename` are optional, and the editor hides those buttons when they are absent, so a
 * read-only catalogue of company templates is a valid store.
 */

export interface MailTemplate {
  id: string;
  name: string;
  document: MailDocument;
  /** ISO 8601 strings, not Date objects — these survive JSON round-trips unchanged. */
  createdAt?: string;
  updatedAt?: string;
  /** Anything the host needs to carry along: ownerId, tags, a thumbnail URL. */
  meta?: Record<string, unknown>;
}

/** What a listing returns. The document is left out so listing a large catalogue is cheap. */
export interface MailTemplateSummary {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  meta?: Record<string, unknown>;
}

export interface SaveTemplateInput {
  /** Omit to create; provide to overwrite. */
  id?: string;
  name: string;
  document: MailDocument;
  meta?: Record<string, unknown>;
}

export interface TemplateStore {
  list(): Promise<MailTemplateSummary[]>;
  load(id: string): Promise<MailTemplate | null>;
  save(input: SaveTemplateInput): Promise<MailTemplate>;
  /** Omit to make the store read-only; the delete button disappears. */
  remove?(id: string): Promise<void>;
  /** Omit and renaming falls back to a save with the same id. */
  rename?(id: string, name: string): Promise<MailTemplate>;
}

/**
 * Coercion may add what is missing; it may not reinterpret what is present.
 *
 * That line is the whole rule. A row with no `blocks` is an empty mail and opening it is
 * harmless. A row whose `blocks` is a string is damaged, and turning it into `[]` presents
 * an empty template the user will save over — data loss wearing the costume of a repair. A
 * `version` we do not know is the same story from the future: coercing it to 1 and saving
 * back downgrades a document written by a later release.
 */
function repairable(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  if (doc.version !== undefined && doc.version !== 1) return false;
  if (doc.blocks !== undefined && !Array.isArray(doc.blocks)) return false;
  if (doc.settings !== undefined && (typeof doc.settings !== "object" || doc.settings === null)) {
    return false;
  }
  return true;
}

/**
 * Normalise whatever came out of storage into a MailTemplate the editor can open.
 * Adapters should route every read through this so one malformed row cannot crash the UI.
 */
export function parseTemplate(raw: unknown): MailTemplate | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;

  /*
   * Coerce, then validate what coercion produced — and reject if it is still wrong.
   *
   * This path used to coerce and stop there, which is the one thing `validate.ts` exists to
   * prevent: `coerceDocument` fills in missing top-level fields but spreads `blocks` through
   * untouched, so a row whose blocks were malformed reached the editor by exactly the route
   * built to stop it. Validating *after* keeps the repair — a row missing `settings` is still
   * openable — while a structurally broken one is refused.
   */
  if (!repairable(row.document)) return null;
  const document = coerceDocument(row.document);
  if (!validateDocument(document).ok) return null;
  const template: MailTemplate = {
    id,
    name: typeof row.name === "string" && row.name ? row.name : "Untitled",
    document,
  };
  if (typeof row.createdAt === "string") template.createdAt = row.createdAt;
  if (typeof row.updatedAt === "string") template.updatedAt = row.updatedAt;
  if (typeof row.meta === "object" && row.meta !== null) {
    template.meta = row.meta as Record<string, unknown>;
  }
  return template;
}

/** Reject a structurally broken document before it reaches storage. */
export function assertSavable(input: SaveTemplateInput): void {
  if (!input.name?.trim()) throw new Error("A template must have a name.");
  const result = validateDocument(input.document);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(
      `Mallen kan inte sparas: ${first?.message ?? "ogiltigt dokument"}` +
        (first?.path ? ` (${first.path})` : ""),
    );
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------- memory store */

/**
 * In-memory store. For the playground, tests, and as the reference implementation an
 * adapter author can read in one sitting.
 */
export function createMemoryTemplateStore(seed: MailTemplate[] = []): TemplateStore {
  const rows = new Map<string, MailTemplate>(seed.map((t) => [t.id, t]));

  return {
    async list() {
      return [...rows.values()]
        .map(({ document: _document, ...summary }) => summary)
        .sort(byNewest);
    },
    async load(id) {
      const row = rows.get(id);
      return row ? structuredClone(row) : null;
    },
    async save(input) {
      assertSavable(input);
      const id = input.id ?? randomId();
      const existing = rows.get(id);
      const row: MailTemplate = {
        id,
        name: input.name.trim(),
        document: structuredClone(input.document),
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
        ...(input.meta ? { meta: input.meta } : {}),
      };
      rows.set(id, row);
      return structuredClone(row);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

/* -------------------------------------------------- localStorage store */

/**
 * Per-browser store. Genuinely useful for a single-user tool or a demo, and the honest
 * limits are worth stating: it never leaves the device, a cleared browser takes the
 * templates with it, and the quota is a few megabytes.
 */
export function createLocalStorageTemplateStore(
  options: { key?: string; storage?: Storage } = {},
): TemplateStore {
  const key = options.key ?? "mail-designer:templates";

  const getStorage = (): Storage | null => {
    if (options.storage) return options.storage;
    try {
      // Private windows and blocked site data make this throw rather than return null.
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  };

  const readAll = (): MailTemplate[] => {
    const storage = getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(parseTemplate).filter((t): t is MailTemplate => t !== null);
    } catch {
      // A corrupt blob should not brick the editor; start over rather than throw.
      return [];
    }
  };

  const writeAll = (rows: MailTemplate[]): void => {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(rows));
    } catch {
      throw new Error("Could not save the template — browser storage is full or blocked.");
    }
  };

  return {
    async list() {
      return readAll()
        .map(({ document: _document, ...summary }) => summary)
        .sort(byNewest);
    },
    async load(id) {
      return readAll().find((t) => t.id === id) ?? null;
    },
    async save(input) {
      assertSavable(input);
      const rows = readAll();
      const id = input.id ?? randomId();
      const existing = rows.find((t) => t.id === id);
      const row: MailTemplate = {
        id,
        name: input.name.trim(),
        document: input.document,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
        ...(input.meta ? { meta: input.meta } : {}),
      };
      writeAll([row, ...rows.filter((t) => t.id !== id)]);
      return row;
    },
    async remove(id) {
      writeAll(readAll().filter((t) => t.id !== id));
    },
  };
}

/* -------------------------------------------------------------- REST store */

export interface RestTemplateStoreOptions {
  /** Collection URL, without a trailing slash. */
  baseUrl: string;
  /** Inject your own fetch to add auth, retries or a mock in tests. */
  fetch?: typeof fetch;
  /** Static headers, or a function called per request for a fresh bearer token. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}

/**
 * The universal bridge. Any backend that can serve five endpoints works with this —
 * including ASP.NET, which is why there is no need for a .NET client library to make the
 * editor work. See docs/templates.md for the exact contract and a controller sketch.
 *
 *   GET    {baseUrl}          -> MailTemplateSummary[]
 *   GET    {baseUrl}/{id}     -> MailTemplate | 404
 *   POST   {baseUrl}          -> MailTemplate   (body: SaveTemplateInput without id)
 *   PUT    {baseUrl}/{id}     -> MailTemplate   (body: SaveTemplateInput)
 *   DELETE {baseUrl}/{id}     -> 204
 */
export function createRestTemplateStore(options: RestTemplateStoreOptions): TemplateStore {
  const base = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!doFetch) {
    throw new Error("createRestTemplateStore needs a fetch implementation on this runtime.");
  }

  const resolveHeaders = async (): Promise<Record<string, string>> => {
    const value = typeof options.headers === "function" ? await options.headers() : options.headers;
    return { "content-type": "application/json", ...(value ?? {}) };
  };

  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const response = await doFetch(`${base}${path}`, {
      ...init,
      headers: { ...(await resolveHeaders()), ...(init.headers as Record<string, string>) },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Mall-API svarade ${response.status} ${response.statusText}.`);
    }
    return response;
  };

  return {
    async list() {
      const response = await request("");
      const rows = (await response.json()) as unknown;
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row) => parseTemplate(row))
        .filter((t): t is MailTemplate => t !== null)
        .map(({ document: _document, ...summary }) => summary);
    },
    async load(id) {
      const response = await request(`/${encodeURIComponent(id)}`);
      if (response.status === 404) return null;
      return parseTemplate(await response.json());
    },
    async save(input) {
      assertSavable(input);
      const body = JSON.stringify({
        name: input.name.trim(),
        document: input.document,
        ...(input.meta ? { meta: input.meta } : {}),
      });
      const response = input.id
        ? await request(`/${encodeURIComponent(input.id)}`, { method: "PUT", body })
        : await request("", { method: "POST", body });
      const saved = parseTemplate(await response.json());
      if (!saved) throw new Error("The template API returned a response that could not be parsed.");
      return saved;
    },
    async remove(id) {
      await request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

function byNewest(a: MailTemplateSummary, b: MailTemplateSummary): number {
  return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
}
