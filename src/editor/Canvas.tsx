import type { ReactNode, RefObject } from "react";
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
import type { Container } from "../document.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import { spacingToCss } from "../blocks/canvasStyle.js";
import { DropIndicator } from "./dnd/DropIndicator.js";
import type { DropTarget } from "./dnd/findDropTarget.js";
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
export function Canvas({
  canvasRef,
  dropTarget,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  dropTarget: DropTarget | null;
}) {
  const {
    doc, select, selectedId, insert, remove, move, isDragging, viewportWidth,
    permissions, capabilities, t,
  } = useEditor();

  /**
   * Alt+arrows are the keyboard equivalent of dragging. Not a nicety: drag-and-drop is
   * unusable with a keyboard, and an editor that can only be operated with a pointer
   * excludes people outright.
   *
   *   Alt+Up/Down    reorder within the current container
   *   Alt+Right      step into the next columns row, or across to the next column
   *   Alt+Left       step back out of a column, landing after the row it was in
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!selectedId) return;
      const found = findBlock(doc, selectedId);
      if (!found) return;

      const caps = capabilities(found.block);

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!caps.remove) return;
        event.preventDefault();
        remove(selectedId);
        select(null);
        return;
      }
      if (!event.altKey || !caps.move) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        // Moving down needs +2: moveBlock subtracts one for the block's own removal.
        const index = event.key === "ArrowUp" ? found.index - 1 : found.index + 2;
        move(selectedId, { container: found.container, index });
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const target = lateralTarget(doc, found, event.key === "ArrowRight" ? 1 : -1);
        if (!target) return;
        event.preventDefault();
        move(selectedId, target);
      }
    },
    [doc, selectedId, remove, select, move, capabilities],
  );

  return (
    <div
      ref={canvasRef}
      className={`md-canvas${isDragging ? " is-dragging" : ""}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <div
        className="md-page"
        // The canvas honours the viewport toggle too, so mobile can be checked without
        // leaving edit mode.
        style={{ background: doc.settings.backgroundColor, maxWidth: viewportWidth }}
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

        {permissions.structure ? (
          <button
            type="button"
            className="md-add-section"
            onClick={() =>
              insert(createBlock("section"), {
                container: { kind: "document" },
                index: doc.blocks.length,
              })
            }
          >
            <Icon name="plus" size={12} />
            {t("canvas.addSection")}
          </button>
        ) : null}
      </div>

      <DropIndicator target={dropTarget} />
    </div>
  );
}

/**
 * Where Alt+Left / Alt+Right sends a block. Returns null when the move has no meaning —
 * a section has nowhere sideways to go — so the arrow key keeps its normal behaviour.
 */
function lateralTarget(
  doc: ReturnType<typeof useEditor>["doc"],
  found: NonNullable<ReturnType<typeof findBlock>>,
  direction: 1 | -1,
): { container: Container; index: number } | null {
  if (found.block.type === "section" || found.block.type === "columns") return null;

  for (const section of doc.blocks) {
    for (const [index, child] of section.children.entries()) {
      if (child.type !== "columns") continue;

      const columnIndex = child.columns.findIndex((c) => c.id === (found.container as { id?: string }).id);

      if (columnIndex === -1) {
        // Sitting in the section: stepping right enters the columns row that follows.
        if (
          direction === 1 &&
          found.container.kind === "section" &&
          found.container.id === section.id &&
          index === found.index + 1
        ) {
          const first = child.columns[0];
          return first ? { container: { kind: "column", id: first.id }, index: 0 } : null;
        }
        continue;
      }

      // Sitting in a column: step across, or out to the section after the row.
      const next = child.columns[columnIndex + direction];
      if (next) return { container: { kind: "column", id: next.id }, index: next.children.length };
      if (direction === -1) return { container: { kind: "section", id: section.id }, index: index + 1 };
      return null;
    }
  }
  return null;
}

function SectionView({ section }: { section: SectionBlock }) {
  const { doc, viewportWidth, isMobileViewport, t } = useEditor();
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
            maxWidth: Math.min(settings.width, viewportWidth),
            margin: "0 auto",
            background: innerBackground,
            padding: spacingToCss(
              isMobileViewport ? (section.mobilePadding ?? section.padding) : section.padding,
            ),
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
  const { doc, isMobileViewport, viewportWidth } = useEditor();
  // Mirrors renderColumns: the gap comes out of the percentages so every column ends up
  // with the same content width, rather than the middle one being a gap narrower.
  const rowWidth = Math.min(doc.settings.width, viewportWidth);
  const widths = computeWidths(block.columns, { totalWidth: rowWidth, gap: block.gap });
  // Mirrors the media query the renderer emits. Without this the canvas would show columns
  // side by side at 375px while the actual email stacks them — the one thing the mobile
  // toggle exists to reveal.
  const stacked = isMobileViewport && block.stackOnMobile;

  return (
    <BlockShell block={block} variant="columns">
      <div
        style={{
          display: stacked ? "block" : "flex",
          padding: spacingToCss(block.padding),
        }}
      >
        {block.columns.map((column, index) => (
          <ColumnView
            key={column.id}
            column={column}
            width={stacked ? 100 : (widths[index] ?? 0)}
            gap={block.gap}
            stacked={stacked}
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
  stacked,
  isFirst,
  isLast,
}: {
  column: MailColumn;
  width: number;
  gap: number;
  stacked: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useEditor();
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
        // Stacked, the gap moves from between the columns to above each one but the first
        // — exactly what the .md-cgN adjacent-sibling rule does in the rendered email.
        paddingTop: base[0] + (stacked && !isFirst ? gap : 0),
        paddingRight: base[1] + (stacked || isLast ? 0 : gap),
        paddingBottom: base[2],
        paddingLeft: base[3],
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
  const { selectedId, isMobileViewport } = useEditor();
  const active = selectedId === block.id;
  return (
    <BlockShell block={block} variant="leaf">
      {/* The canvas honours the mobile override too, or the toggle would show a layout the
          recipient never gets. */}
      <div
        style={{
          padding: spacingToCss(
            isMobileViewport ? (block.mobilePadding ?? block.padding) : block.padding,
          ),
        }}
      >
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
  const { doc, selectedId, select, remove, duplicate, move, startBlockDrag, capabilities, t } =
    useEditor();
  const active = selectedId === block.id;
  const found = findBlock(doc, block.id);
  const caps = capabilities(block);
  // Nothing to act on: no bar rather than a bar of disabled buttons, which only invites
  // clicking to find out why.
  const anyAction = caps.move || caps.remove;

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
      <span className="md-block-label">
        {t(`block.${block.type}` as "block.text")}
        {caps.locked ? <Icon name="lock" size={9} /> : null}
      </span>

      {found && anyAction ? (
        <div className="md-block-actions" onClick={(e) => e.stopPropagation()}>
          {caps.move ? (
            <>
              <span
                className="md-grip"
                title={t("palette.hint")}
                onPointerDown={(e) => startBlockDrag(block.id, e)}
              >
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
            </>
          ) : null}
          {caps.remove ? (
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
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
