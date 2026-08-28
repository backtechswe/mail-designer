import type { Block, ColumnsBlock, MailDocument, SectionBlock } from "../types.js";
import { fieldsInBlock } from "./dataFields.js";

/** Keeps the element type through a filter, which a bare `!== null` predicate loses. */
const present = <T,>(value: T | null): value is T => value !== null;

/**
 * Remove the blocks that `hideWhenEmpty` says have nothing to show.
 *
 * This runs before rendering rather than after substitution, which is the only order that
 * can work: substitution operates on the assembled HTML string, and by then there is no
 * block left to remove — only text inside one. It does mean the feature needs the data at
 * render time, and the docblock on `hideWhenEmpty` says so.
 *
 * Both outputs are pruned from the same document, so the HTML and the plain-text
 * alternative always agree about what the mail contains.
 */
export function pruneEmptyBlocks(
  doc: MailDocument,
  data: Record<string, string> | undefined,
): MailDocument {
  if (!hasAnyConditional(doc)) return doc;
  const blocks = doc.blocks
    .map((section) => pruneBlock(section, data))
    .filter(present);
  return { ...doc, blocks };
}

/** Nothing to do for the overwhelming majority of documents, so do not copy the tree. */
function hasAnyConditional(doc: MailDocument): boolean {
  const any = (blocks: readonly Block[]): boolean =>
    blocks.some((block) => {
      if (block.hideWhenEmpty) return true;
      if (block.type === "section") return any(block.children);
      if (block.type === "columns") return block.columns.some((c) => any(c.children));
      return false;
    });
  return any(doc.blocks);
}

function pruneBlock<T extends Block>(block: T, data: Record<string, string> | undefined): T | null {
  let next = block;

  // Depth first: a section whose only child dropped is itself empty, and should go too if
  // it asked to. Pruning the parent before the child would miss that.
  if (block.type === "section") {
    const children = block.children
      .map((child) => pruneBlock(child, data))
      .filter(present);
    next = { ...block, children } as T;
  } else if (block.type === "columns") {
    const columns = (block as ColumnsBlock).columns.map((column) => ({
      ...column,
      children: column.children
        .map((child) => pruneBlock(child, data))
        .filter(present),
    }));
    next = { ...block, columns } as T;
  }

  if (!block.hideWhenEmpty) return next;

  if (next.type === "section") {
    return (next as unknown as SectionBlock).children.length ? next : null;
  }
  if (next.type === "columns") {
    return (next as unknown as ColumnsBlock).columns.some((c) => c.children.length) ? next : null;
  }

  const fields = fieldsInBlock(next);
  if (fields.length === 0) return next;
  return fields.some((name) => hasValue(data, name)) ? next : null;
}

/** Matched the way substitution matches: trimmed, case-insensitive, blank counts as absent. */
function hasValue(data: Record<string, string> | undefined, name: string): boolean {
  if (!data) return false;
  const direct = data[name];
  if (direct !== undefined) return direct.trim() !== "";
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase() === lower) return value.trim() !== "";
  }
  return false;
}
