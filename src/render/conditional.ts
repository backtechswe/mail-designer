import type { Block, ColumnsBlock, MailDocument, SectionBlock } from "../types.js";
import { fieldsInBlock } from "./dataFields.js";

/** Keeps the element type through a filter, which a bare `!== null` predicate loses. */
const present = <T,>(value: T | null): value is T => value !== null;

export interface PruneResult {
  doc: MailDocument;
  /**
   * Ids of the blocks dropped because the fields they refer to had no value — as opposed to
   * a container dropped because everything inside it went. This is the list `toHtml` warns
   * about when it was given no data at all: with none, every one of these was decided by an
   * absence the caller never supplied, and the result is a mail missing content for
   * recipients who had it.
   */
  droppedForMissingValue: string[];
}

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
): PruneResult {
  if (!hasAnyConditional(doc)) return { doc, droppedForMissingValue: [] };
  const droppedForMissingValue: string[] = [];
  const blocks = doc.blocks
    .map((section) => pruneBlock(section, data, droppedForMissingValue))
    .filter(present);
  return { doc: { ...doc, blocks }, droppedForMissingValue };
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

function pruneBlock<T extends Block>(
  block: T,
  data: Record<string, string> | undefined,
  dropped: string[],
): T | null {
  let next = block;

  // Depth first: a section whose only child dropped is itself empty, and should go too if
  // it asked to. Pruning the parent before the child would miss that.
  if (block.type === "section") {
    const children = block.children
      .map((child) => pruneBlock(child, data, dropped))
      .filter(present);
    next = { ...block, children } as T;
  } else if (block.type === "columns") {
    const columns = (block as ColumnsBlock).columns.map((column) => ({
      ...column,
      children: column.children
        .map((child) => pruneBlock(child, data, dropped))
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
  if (fields.some((name) => hasValue(data, name))) return next;
  dropped.push(next.id);
  return null;
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
