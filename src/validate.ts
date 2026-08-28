import type { MailDocument } from "./types.js";
import { defaultSettings } from "./document.js";
import { toSpacing } from "./render/values.js";

/**
 * Runtime validation for documents coming back from storage.
 *
 * A MailDocument is JSON that has been round-tripped through someone else's database,
 * possibly written by an older version of this package. Trusting it blindly means a
 * malformed row takes down the editor, so every load goes through here first.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const LEAF_TYPES = new Set([
  "heading",
  "text",
  "image",
  "button",
  "social",
  "divider",
  "spacer",
  "html",
]);

export function validateDocument(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  if (typeof value !== "object" || value === null) {
    return { ok: false, issues: [{ path: "", message: "Document must be an object." }] };
  }
  const doc = value as Record<string, unknown>;

  if (doc.version !== 1) {
    push("version", `Unsupported document version: ${String(doc.version)}. Expected 1.`);
  }
  if (typeof doc.settings !== "object" || doc.settings === null) {
    push("settings", "Missing settings object.");
  }
  if (!Array.isArray(doc.blocks)) {
    push("blocks", "Missing blocks array.");
    return { ok: false, issues };
  }

  doc.blocks.forEach((block, i) => validateSection(block, `blocks[${i}]`, push));
  return { ok: issues.length === 0, issues };
}

function validateSection(
  value: unknown,
  path: string,
  push: (path: string, message: string) => void,
): void {
  const block = asBlock(value, path, push);
  if (!block) return;
  if (block.type !== "section") {
    push(path, `Top-level blocks must be sections, got "${String(block.type)}".`);
    return;
  }
  if (!Array.isArray(block.children)) {
    push(`${path}.children`, "Section is missing its children array.");
    return;
  }
  block.children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    const node = asBlock(child, childPath, push);
    if (!node) return;
    if (node.type === "columns") {
      if (!Array.isArray(node.columns)) {
        push(`${childPath}.columns`, "Columns block is missing its columns array.");
        return;
      }
      node.columns.forEach((column, c) => {
        const columnPath = `${childPath}.columns[${c}]`;
        if (typeof column !== "object" || column === null) {
          push(columnPath, "Column must be an object.");
          return;
        }
        const children = (column as Record<string, unknown>).children;
        if (!Array.isArray(children)) {
          push(`${columnPath}.children`, "Column is missing its children array.");
          return;
        }
        children.forEach((leaf, l) => {
          const leafPath = `${columnPath}.children[${l}]`;
          const node2 = asBlock(leaf, leafPath, push);
          if (node2 && !LEAF_TYPES.has(String(node2.type))) {
            push(leafPath, `"${String(node2.type)}" is not allowed inside a column.`);
          }
        });
      });
      return;
    }
    if (!LEAF_TYPES.has(String(node.type))) {
      push(childPath, `"${String(node.type)}" is not allowed inside a section.`);
    }
  });
}

function asBlock(
  value: unknown,
  path: string,
  push: (path: string, message: string) => void,
): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    push(path, "Block must be an object.");
    return undefined;
  }
  const block = value as Record<string, unknown>;
  if (typeof block.id !== "string" || !block.id) push(`${path}.id`, "Block is missing an id.");
  if (typeof block.type !== "string") push(`${path}.type`, "Block is missing a type.");
  checkSpacing(block, path, push);
  return block;
}

/**
 * Spacing is [top, right, bottom, left]. Nothing checked it, so a document holding
 * `{ top, right, bottom, left }` or `"12px 24px"` — the shapes an agent or a hand-written
 * fixture produces — passed as ok and then threw inside the renderer. A validator that
 * approves a document which cannot be rendered is worse than no validator, because
 * docs/backend-dotnet.md tells hosts to store the document opaquely and check it here.
 *
 * Only reported when the key is present. A missing one is filled by coerceDocument, and
 * older stored documents predate some of these fields.
 */
function checkSpacing(
  block: Record<string, unknown>,
  path: string,
  push: (path: string, message: string) => void,
): void {
  const keys = block.type === "button"
    ? ["padding", "mobilePadding", "innerPadding"]
    : ["padding", "mobilePadding"];
  for (const key of keys) {
    if (block[key] === undefined) continue;
    if (toSpacing(block[key]) === null) {
      push(
        `${path}.${key}`,
        "Spacing must be one to four finite numbers — [top, right, bottom, left].",
      );
    }
  }
}

/**
 * Fill in whatever a stored document is missing so the editor can always open it.
 *
 * Use this on load, after validateDocument: a document written by an older release may
 * simply lack a settings field that has since been added, and refusing to open it would
 * be worse than defaulting it. Structural problems are not repaired — those are real
 * corruption and should surface as an error to the user.
 */
export function coerceDocument(value: unknown): MailDocument {
  const doc = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const settings = (typeof doc.settings === "object" && doc.settings !== null
    ? doc.settings
    : {}) as Record<string, unknown>;

  return {
    version: 1,
    settings: { ...defaultSettings, ...settings } as MailDocument["settings"],
    blocks: Array.isArray(doc.blocks)
      ? (doc.blocks.map(repairBlock) as MailDocument["blocks"])
      : [],
  };
}

const BUTTON_INNER_PADDING: [number, number, number, number] = [12, 24, 12, 24];

/**
 * Normalise the spacing encodings that are a different way of saying the same thing.
 *
 * `{ top, right, bottom, left }` and `"12px 24px"` are not corruption — they are what
 * someone writing a document by hand, or an agent writing one through the MCP server,
 * reaches for. Turning them into the tuple is a repair in the same spirit as filling in a
 * settings field an older release did not have. A value that cannot be read as spacing at
 * all is dropped rather than guessed at, which leaves the renderer's own default.
 */
function repairBlock(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const block = { ...(value as Record<string, unknown>) };

  for (const key of ["padding", "mobilePadding", "innerPadding"]) {
    if (!(key in block)) continue;
    const fixed = toSpacing(block[key]);
    if (fixed) block[key] = fixed;
    else delete block[key];
  }
  // A button reaches arithmetic that a missing value would turn into NaN, so it gets the
  // same default createBlock would have given it rather than nothing.
  if (block.type === "button" && !block.innerPadding) block.innerPadding = BUTTON_INNER_PADDING;

  if (Array.isArray(block.children)) block.children = block.children.map(repairBlock);
  if (Array.isArray(block.columns)) {
    block.columns = block.columns.map((column) => {
      if (typeof column !== "object" || column === null) return column;
      const c = { ...(column as Record<string, unknown>) };
      if (Array.isArray(c.children)) c.children = c.children.map(repairBlock);
      return c;
    });
  }
  return block;
}
