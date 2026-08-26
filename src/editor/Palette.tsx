import type { BlockType } from "../types.js";
import { createBlock, createSection, findBlock } from "../document.js";
import type { Position } from "../document.js";
import { useEditor } from "./EditorContext.js";
import { allowsBlockType } from "../permissions.js";
import { Icon } from "./icons.js";
import type { IconName } from "./icons.js";
import { useSlot } from "./customise.js";

const PALETTE: { type: BlockType; icon: IconName }[] = [
  { type: "section", icon: "section" },
  { type: "heading", icon: "heading" },
  { type: "text", icon: "text" },
  { type: "image", icon: "image" },
  { type: "button", icon: "button" },
  { type: "columns", icon: "columns" },
  { type: "social", icon: "social" },
  { type: "divider", icon: "divider" },
  { type: "spacer", icon: "spacer" },
  { type: "html", icon: "code" },
];

export function Palette({
  onDragStart,
}: {
  /** Supplied by the drag layer. Absent means click-to-append only. */
  onDragStart?: (type: BlockType, event: React.PointerEvent) => void;
}) {
  const { doc, selectedId, insert, select, permissions, t } = useEditor();
  const slot = useSlot();
  const offered = PALETTE.filter(({ type }) => allowsBlockType(permissions, type));
  if (!permissions.structure || offered.length === 0) return null;

  /**
   * Where a click puts the new block. Following the selection is what makes the palette
   * feel like "insert here" rather than "append somewhere" — if a text block is selected,
   * the next block lands right under it, in the same column.
   */
  const targetFor = (type: BlockType): Position => {
    if (type === "section") {
      return { container: { kind: "document" }, index: doc.blocks.length };
    }
    const found = selectedId ? findBlock(doc, selectedId) : undefined;
    if (found && found.container.kind !== "document") {
      // A columns block cannot go inside a column, so fall back to the enclosing section.
      if (type === "columns" && found.container.kind === "column") {
        const section = doc.blocks.find((s) =>
          s.children.some((c) => c.type === "columns" && c.columns.some((col) => col.id === (found.container as { id: string }).id)),
        );
        if (section) {
          return { container: { kind: "section", id: section.id }, index: section.children.length };
        }
      } else {
        return { container: found.container, index: found.index + 1 };
      }
    }
    if (found && found.block.type === "section") {
      return { container: { kind: "section", id: found.block.id }, index: found.block.children.length };
    }
    const last = doc.blocks[doc.blocks.length - 1];
    if (last) {
      return { container: { kind: "section", id: last.id }, index: last.children.length };
    }
    return { container: { kind: "document" }, index: 0 };
  };

  const add = (type: BlockType): void => {
    // A leaf needs somewhere to live; an empty document gets a section first.
    if (type !== "section" && doc.blocks.length === 0) {
      const section = createSection([createBlock(type) as never]);
      insert(section, { container: { kind: "document" }, index: 0 });
      select(section.children[0]?.id ?? section.id);
      return;
    }
    const block = createBlock(type);
    insert(block, targetFor(type));
    select(block.id);
  };

  return (
    <aside className={slot("palette", "md-palette")}>
      <h3>{t("palette.title")}</h3>
      <p className="md-palette-hint">{t("palette.hint")}</p>
      <div className="md-palette-list">
        {offered.map(({ type, icon }) => (
          <button
            key={type}
            type="button"
            className={slot("button", "md-palette-item")}
            onClick={() => add(type)}
            onPointerDown={onDragStart ? (e) => onDragStart(type, e) : undefined}
          >
            <Icon name={icon} size={14} />
            <span>{t(`block.${type}` as "block.text")}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
