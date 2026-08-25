import type { ReactNode } from "react";
import { useCallback } from "react";
import type {
  Block,
  ColumnsBlock,
  LeafBlock,
  MailColumn,
  SectionBlock,
  SectionChild,
} from "../types.js";
import { computeWidths } from "../render/html/columns.js";
import { createBlock, findBlock } from "../document.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import { spacingToCss } from "../blocks/canvasStyle.js";
import { HeadingView } from "../blocks/heading.js";
import { TextView } from "../blocks/text.js";
import { ImageView } from "../blocks/image.js";
import { ButtonView } from "../blocks/button.js";
import { DividerView } from "../blocks/divider.js";
import { SpacerView } from "../blocks/spacer.js";
import { SocialView } from "../blocks/social.js";
import { HtmlView } from "../blocks/html.js";

/**
 * The editing surface.
 *
 * It draws React components, not the renderer's HTML. An iframe of the real output cannot
 * be clicked into, typed in, or dropped onto without a great deal of bridging — so the
 * canvas approximates the email closely (the style helpers in blocks/canvasStyle.ts mirror
 * the emitters) and the Preview tab shows the byte-exact truth.
 *
 * Every block carries data-md-id and every container data-md-container. Those attributes
 * are how drag-and-drop measures drop targets without the tree having to register anything.
 */
export function Canvas() {
  const { doc, select, selectedId, insert, remove, move, t } = useEditor();

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!selectedId) return;
      const found = findBlock(doc, selectedId);
      if (!found) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove(selectedId);
        select(null);
        return;
      }
      // Alt+arrows are the keyboard equivalent of dragging, so the editor is usable
      // without a pointer at all.
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? -1 : 1;
        move(selectedId, { container: found.container, index: found.index + delta + (delta > 0 ? 1 : 0) });
      }
    },
    [doc, selectedId, remove, select, move, t],
  );

  return (
    <div
      className="md-canvas"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <div
        className="md-page"
        style={{ background: doc.settings.backgroundColor }}
        data-md-container="document"
      >
        {doc.blocks.length === 0 ? (
          <div className="md-empty">
            <strong>{t("canvas.empty")}</strong>
            <span>{t("canvas.emptyHint")}</span>
          </div>
        ) : (
          doc.blocks.map((section) => <SectionView key={section.id} section={section} />)
        )}

        <button
          type="button"
          className="md-add-section"
          onClick={() =>
            insert(createBlock("section"), { container: { kind: "document" }, index: doc.blocks.length })
          }
        >
          <Icon name="plus" size={12} />
          {t("canvas.addSection")}
        </button>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: SectionBlock }) {
  const { doc, t } = useEditor();
  const { settings } = doc;

  // Mirrors renderSection: fullWidth puts the colour on the outer band, otherwise it stays
  // inside the content column.
  const outerBackground = section.fullWidth ? section.backgroundColor : undefined;
  const innerBackground = section.fullWidth
    ? undefined
    : (section.backgroundColor ?? settings.contentBackgroundColor);

  return (
    <BlockShell block={section} variant="section">
      <div style={{ background: outerBackground }}>
        <div
          style={{
            maxWidth: settings.width,
            margin: "0 auto",
            background: innerBackground,
            padding: spacingToCss(section.padding),
          }}
          data-md-container={`section:${section.id}`}
        >
          {section.children.length === 0 ? (
            <div className="md-empty md-empty--inline">{t("canvas.emptySection")}</div>
          ) : (
            section.children.map((child) => <ChildView key={child.id} child={child} />)
          )}
        </div>
      </div>
    </BlockShell>
  );
}

function ChildView({ child }: { child: SectionChild }) {
  if (child.type === "columns") return <ColumnsView block={child} />;
  return <LeafShell block={child} />;
}

function ColumnsView({ block }: { block: ColumnsBlock }) {
  const widths = computeWidths(block.columns);
  return (
    <BlockShell block={block} variant="columns">
      <div style={{ display: "flex", padding: spacingToCss(block.padding) }}>
        {block.columns.map((column, index) => (
          <ColumnView
            key={column.id}
            column={column}
            width={widths[index] ?? 0}
            gap={block.gap}
            isFirst={index === 0}
            isLast={index === block.columns.length - 1}
          />
        ))}
      </div>
    </BlockShell>
  );
}

function ColumnView({
  column,
  width,
  gap,
  isFirst,
  isLast,
}: {
  column: MailColumn;
  width: number;
  gap: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useEditor();
  const half = Math.round(gap / 2);
  const base = column.padding ?? [0, 0, 0, 0];
  return (
    <div
      className="md-column"
      data-md-container={`column:${column.id}`}
      style={{
        width: `${width}%`,
        boxSizing: "border-box",
        background: column.backgroundColor,
        verticalAlign: column.verticalAlign ?? "top",
        paddingTop: base[0],
        paddingRight: base[1] + (isLast ? 0 : half),
        paddingBottom: base[2],
        paddingLeft: base[3] + (isFirst ? 0 : half),
      }}
    >
      {column.children.length === 0 ? (
        <div className="md-empty md-empty--inline">{t("canvas.emptySection")}</div>
      ) : (
        column.children.map((leaf) => <LeafShell key={leaf.id} block={leaf} />)
      )}
    </div>
  );
}

function LeafShell({ block }: { block: LeafBlock }) {
  const { selectedId } = useEditor();
  const active = selectedId === block.id;
  return (
    <BlockShell block={block} variant="leaf">
      <div style={{ padding: spacingToCss(block.padding) }}>
        <LeafView block={block} active={active} />
      </div>
    </BlockShell>
  );
}

function LeafView({ block, active }: { block: LeafBlock; active: boolean }) {
  switch (block.type) {
    case "heading":
      return <HeadingView block={block} active={active} />;
    case "text":
      return <TextView block={block} active={active} />;
    case "image":
      return <ImageView block={block} />;
    case "button":
      return <ButtonView block={block} />;
    case "divider":
      return <DividerView block={block} />;
    case "spacer":
      return <SpacerView block={block} active={active} />;
    case "social":
      return <SocialView block={block} />;
    case "html":
      return <HtmlView block={block} />;
  }
}

/**
 * Selection outline plus the per-block action bar. One component for every block type so
 * selection behaves identically everywhere, including the nested case where clicking a
 * text block inside a column must not also select the column and the section.
 */
function BlockShell({
  block,
  variant,
  children,
}: {
  block: Block;
  variant: "section" | "columns" | "leaf";
  children: ReactNode;
}) {
  const { doc, selectedId, select, remove, duplicate, move, t } = useEditor();
  const active = selectedId === block.id;
  const found = findBlock(doc, block.id);

  return (
    <div
      className={`md-block md-block--${variant}${active ? " is-selected" : ""}`}
      data-md-id={block.id}
      onClick={(e) => {
        // Innermost block wins: without this a click lands on the section too.
        e.stopPropagation();
        select(block.id);
      }}
    >
      <span className="md-block-label">{t(`block.${block.type}` as "block.text")}</span>

      {active && found ? (
        <div className="md-block-actions" onClick={(e) => e.stopPropagation()}>
          <span className="md-grip" title={t("action.moveUp")} data-md-grip={block.id}>
            <Icon name="grip" size={12} />
          </span>
          <button
            type="button"
            title={t("action.moveUp")}
            disabled={found.index === 0}
            onClick={() => move(block.id, { container: found.container, index: found.index - 1 })}
          >
            <Icon name="up" size={12} />
          </button>
          <button
            type="button"
            title={t("action.moveDown")}
            onClick={() => move(block.id, { container: found.container, index: found.index + 2 })}
          >
            <Icon name="down" size={12} />
          </button>
          <button type="button" title={t("action.duplicate")} onClick={() => duplicate(block.id)}>
            <Icon name="copy" size={12} />
          </button>
          <button
            type="button"
            className="md-danger"
            title={t("action.delete")}
            onClick={() => {
              remove(block.id);
              select(null);
            }}
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      ) : null}

      {children}
    </div>
  );
}
