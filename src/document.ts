import type {
  Block,
  BlockType,
  ButtonBlock,
  ColumnsBlock,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  LeafBlock,
  MailColumn,
  MailDocument,
  MailSettings,
  SectionBlock,
  SectionChild,
  SocialBlock,
  SpacerBlock,
  TextBlock,
} from "./types.js";

/* ------------------------------------------------------------------------ ids */

let counter = 0;
let idFactory: () => string = () => {
  counter += 1;
  return `b${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

/** Swap in a deterministic generator. Used by tests so snapshots are stable. */
export function setIdFactory(factory: () => string): void {
  idFactory = factory;
}

export function newId(): string {
  return idFactory();
}

/* ------------------------------------------------------------------ defaults */

export const defaultSettings: MailSettings = {
  width: 600,
  backgroundColor: "#f5f5f7",
  contentBackgroundColor: "#ffffff",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: 16,
  lineHeight: 1.5,
  textColor: "#1f1f1f",
  linkColor: "#2f54eb",
};

export function emptyDocument(): MailDocument {
  return {
    version: 1,
    settings: { ...defaultSettings },
    blocks: [createSection([createBlock("text")] as LeafBlock[])],
  };
}

/* ----------------------------------------------------------------- factories */

export function createColumn(children: LeafBlock[] = [], width?: number): MailColumn {
  const column: MailColumn = { id: newId(), children };
  if (width !== undefined) column.width = width;
  return column;
}

export function createSection(children: SectionChild[] = []): SectionBlock {
  return {
    id: newId(),
    type: "section",
    padding: [24, 24, 24, 24],
    children,
  };
}

/**
 * Every block ships with values that already look deliberate — an empty editor with
 * sensible defaults beats one that needs ten fields filled in before it renders.
 */
export function createBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "section":
      return createSection();
    case "columns": {
      const block: ColumnsBlock = {
        id,
        type: "columns",
        gap: 16,
        stackOnMobile: true,
        columns: [createColumn([createBlock("text") as TextBlock]), createColumn([createBlock("text") as TextBlock])],
      };
      return block;
    }
    case "heading": {
      const block: HeadingBlock = {
        id,
        type: "heading",
        level: 2,
        html: "Rubrik",
        align: "left",
        padding: [0, 0, 12, 0],
      };
      return block;
    }
    case "text": {
      const block: TextBlock = {
        id,
        type: "text",
        html: "Skriv din text här.",
        align: "left",
        padding: [0, 0, 12, 0],
      };
      return block;
    }
    case "image": {
      const block: ImageBlock = {
        id,
        type: "image",
        src: "",
        alt: "",
        align: "center",
        padding: [0, 0, 12, 0],
      };
      return block;
    }
    case "button": {
      const block: ButtonBlock = {
        id,
        type: "button",
        label: "Läs mer",
        href: "https://",
        backgroundColor: "#2f54eb",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 16,
        innerPadding: [12, 24, 12, 24],
        align: "left",
        padding: [4, 0, 12, 0],
      };
      return block;
    }
    case "social": {
      const block: SocialBlock = {
        id,
        type: "social",
        items: [],
        iconSize: 24,
        spacing: 8,
        align: "center",
        padding: [8, 0, 8, 0],
      };
      return block;
    }
    case "divider": {
      const block: DividerBlock = {
        id,
        type: "divider",
        color: "#e5e5e5",
        thickness: 1,
        width: 100,
        align: "center",
        padding: [8, 0, 8, 0],
      };
      return block;
    }
    case "spacer": {
      const block: SpacerBlock = { id, type: "spacer", height: 24 };
      return block;
    }
    case "html": {
      const block: HtmlBlock = { id, type: "html", html: "<p>Rå HTML</p>" };
      return block;
    }
  }
}

/* ----------------------------------------------------------------- traversal */

export type Container =
  | { kind: "document" }
  | { kind: "section"; id: string }
  | { kind: "column"; id: string };

export interface Position {
  container: Container;
  index: number;
}

export interface Found {
  block: Block;
  container: Container;
  index: number;
}

export function sameContainer(a: Container, b: Container): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "document" || b.kind === "document") return true;
  return a.id === (b as { id: string }).id;
}

/** Every container in document order, with the ids it holds. Used by drag-and-drop. */
export function listContainers(doc: MailDocument): { container: Container; childIds: string[] }[] {
  const out: { container: Container; childIds: string[] }[] = [
    { container: { kind: "document" }, childIds: doc.blocks.map((b) => b.id) },
  ];
  for (const section of doc.blocks) {
    out.push({
      container: { kind: "section", id: section.id },
      childIds: section.children.map((b) => b.id),
    });
    for (const child of section.children) {
      if (child.type === "columns") {
        for (const column of child.columns) {
          out.push({
            container: { kind: "column", id: column.id },
            childIds: column.children.map((b) => b.id),
          });
        }
      }
    }
  }
  return out;
}

export function findBlock(doc: MailDocument, id: string): Found | undefined {
  for (const [i, section] of doc.blocks.entries()) {
    if (section.id === id) return { block: section, container: { kind: "document" }, index: i };
    for (const [j, child] of section.children.entries()) {
      if (child.id === id) {
        return { block: child, container: { kind: "section", id: section.id }, index: j };
      }
      if (child.type === "columns") {
        for (const column of child.columns) {
          for (const [k, leaf] of column.children.entries()) {
            if (leaf.id === id) {
              return { block: leaf, container: { kind: "column", id: column.id }, index: k };
            }
          }
        }
      }
    }
  }
  return undefined;
}

export function findColumn(doc: MailDocument, id: string): MailColumn | undefined {
  for (const section of doc.blocks) {
    for (const child of section.children) {
      if (child.type !== "columns") continue;
      const hit = child.columns.find((c) => c.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Visit every block depth-first. Return false from visit to stop descending. */
export function walkBlocks(doc: MailDocument, visit: (block: Block) => void): void {
  for (const section of doc.blocks) {
    visit(section);
    for (const child of section.children) {
      visit(child);
      if (child.type === "columns") {
        for (const column of child.columns) {
          for (const leaf of column.children) visit(leaf);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ mutation */

const LEAF_TYPES: BlockType[] = [
  "heading",
  "text",
  "image",
  "button",
  "social",
  "divider",
  "spacer",
  "html",
];

/**
 * The nesting rules, in one place: sections at the top, columns inside sections,
 * leaves inside sections or columns. Drag-and-drop consults this to decide which drop
 * targets to even offer, so an illegal move is never reachable through the UI.
 */
export function canInsert(block: Block, container: Container): boolean {
  switch (container.kind) {
    case "document":
      return block.type === "section";
    case "section":
      return block.type === "columns" || LEAF_TYPES.includes(block.type);
    case "column":
      return LEAF_TYPES.includes(block.type);
  }
}

function mapChildren(
  doc: MailDocument,
  container: Container,
  fn: (children: Block[]) => Block[],
): MailDocument {
  if (container.kind === "document") {
    return { ...doc, blocks: fn(doc.blocks) as SectionBlock[] };
  }
  return {
    ...doc,
    blocks: doc.blocks.map((section) => {
      if (container.kind === "section") {
        if (section.id !== container.id) return section;
        return { ...section, children: fn(section.children) as SectionChild[] };
      }
      return {
        ...section,
        children: section.children.map((child) => {
          if (child.type !== "columns") return child;
          if (!child.columns.some((c) => c.id === container.id)) return child;
          return {
            ...child,
            columns: child.columns.map((column) =>
              column.id === container.id
                ? { ...column, children: fn(column.children) as LeafBlock[] }
                : column,
            ),
          };
        }),
      };
    }),
  };
}

export function insertBlock(doc: MailDocument, block: Block, position: Position): MailDocument {
  if (!canInsert(block, position.container)) {
    throw new Error(
      `Cannot insert a "${block.type}" block into a ${position.container.kind} container.`,
    );
  }
  return mapChildren(doc, position.container, (children) => {
    const index = Math.max(0, Math.min(position.index, children.length));
    return [...children.slice(0, index), block, ...children.slice(index)];
  });
}

export function removeBlock(doc: MailDocument, id: string): MailDocument {
  const found = findBlock(doc, id);
  if (!found) return doc;
  return mapChildren(doc, found.container, (children) => children.filter((b) => b.id !== id));
}

export function moveBlock(doc: MailDocument, id: string, to: Position): MailDocument {
  const found = findBlock(doc, id);
  if (!found) return doc;
  if (!canInsert(found.block, to.container)) return doc;

  // Removing the block first shifts every later index in its own container down by one,
  // so a same-container move past the original slot has to compensate.
  let index = to.index;
  if (sameContainer(found.container, to.container) && found.index < to.index) {
    index -= 1;
  }
  if (sameContainer(found.container, to.container) && index === found.index) return doc;

  const without = removeBlock(doc, id);
  return insertBlock(without, found.block, { container: to.container, index });
}

export function updateBlock<T extends Block>(
  doc: MailDocument,
  id: string,
  patch: Partial<T>,
): MailDocument {
  const found = findBlock(doc, id);
  if (!found) return doc;
  return mapChildren(doc, found.container, (children) =>
    children.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
  );
}

export function updateSettings(doc: MailDocument, patch: Partial<MailSettings>): MailDocument {
  return { ...doc, settings: { ...doc.settings, ...patch } };
}

export function updateColumn(
  doc: MailDocument,
  columnId: string,
  patch: Partial<Omit<MailColumn, "id" | "children">>,
): MailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((section) => ({
      ...section,
      children: section.children.map((child) => {
        if (child.type !== "columns") return child;
        if (!child.columns.some((c) => c.id === columnId)) return child;
        return {
          ...child,
          columns: child.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)),
        };
      }),
    })),
  };
}

/** Deep copy with fresh ids, so the clone is a genuinely independent block. */
export function cloneBlock<T extends Block>(block: T): T {
  const copy = structuredClone(block) as Block;
  reassignIds(copy);
  return copy as T;
}

function reassignIds(block: Block): void {
  block.id = newId();
  if (block.type === "section") {
    for (const child of block.children) reassignIds(child);
  } else if (block.type === "columns") {
    for (const column of block.columns) {
      column.id = newId();
      for (const leaf of column.children) reassignIds(leaf);
    }
  }
}

/** Text properties a block may override, all of which otherwise follow MailSettings. */
export type InheritableProperty = "fontFamily" | "fontSize" | "color" | "lineHeight";

const OVERRIDABLE_TYPES = new Set(["heading", "text", "button"]);

function hasOwn(block: Block, property: InheritableProperty): boolean {
  if (!OVERRIDABLE_TYPES.has(block.type)) return false;
  // A button carries textColor, not color; it has no line height of its own.
  if (block.type === "button" && property !== "fontFamily" && property !== "fontSize") {
    return false;
  }
  return (block as unknown as Record<string, unknown>)[property] !== undefined;
}

/**
 * How many blocks are ignoring the email's setting for this property.
 *
 * This is what makes a two-level settings model usable: without the count, changing a
 * global font and seeing half the mail stay put reads as a bug rather than as blocks doing
 * exactly what they were told.
 */
export function countOverrides(doc: MailDocument, property: InheritableProperty): number {
  let count = 0;
  walkBlocks(doc, (block) => {
    if (hasOwn(block, property)) count += 1;
  });
  return count;
}

/** Drop every block-level value for this property, so the whole mail follows the setting. */
export function clearOverrides(
  doc: MailDocument,
  property: InheritableProperty,
): MailDocument {
  const strip = <T extends Block>(block: T): T => {
    if (!hasOwn(block, property)) return block;
    const copy = { ...block } as Record<string, unknown>;
    delete copy[property];
    return copy as T;
  };

  return {
    ...doc,
    blocks: doc.blocks.map((section) => ({
      ...section,
      children: section.children.map((child) => {
        if (child.type !== "columns") return strip(child);
        return {
          ...child,
          columns: child.columns.map((col) => ({
            ...col,
            children: col.children.map(strip),
          })),
        };
      }),
    })),
  };
}

export function duplicateBlock(doc: MailDocument, id: string): MailDocument {
  const found = findBlock(doc, id);
  if (!found) return doc;
  return insertBlock(doc, cloneBlock(found.block), {
    container: found.container,
    index: found.index + 1,
  });
}
