import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  Block,
  ColorScheme,
  DesignerTheme,
  Locale,
  MailColumn,
  MailDocument,
  MailPreset,
  MailSettings,
} from "./types.js";
import type { Position } from "./document.js";
import {
  duplicateBlock as duplicateBlockIn,
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlock,
  updateColumn as updateColumnIn,
  updateSettings as updateSettingsIn,
} from "./document.js";
import { createI18n, createTranslate } from "./i18n.js";
import type { Strings } from "./i18n.js";
import { EditorProvider } from "./editor/EditorContext.js";
import type { EditorApi } from "./editor/EditorContext.js";
import { useHistory } from "./editor/useHistory.js";
import type { HistoryControls } from "./editor/useHistory.js";
import { resolveColorScheme, themeToStyle } from "./editor/theme.js";
import { Canvas } from "./editor/Canvas.js";
import { Palette } from "./editor/Palette.js";
import { Inspector } from "./editor/Inspector.js";
import { PreviewFrame } from "./editor/PreviewFrame.js";
import { Toolbar } from "./editor/Toolbar.js";
import type { ViewMode, Viewport } from "./editor/Toolbar.js";
import { useDragSort } from "./editor/dnd/useDragSort.js";

/** Width the mobile viewport renders at. Narrow enough to catch real phone problems. */
const MOBILE_WIDTH = 375;

/** Fields whose change is content the reader will see, rather than styling. */
const CONTENT_FIELDS = new Set(["html", "label", "src", "alt", "href", "items", "level"]);

function describeUpdate(patch: object): "history.edit" | "history.style" {
  return Object.keys(patch).some((key) => CONTENT_FIELDS.has(key))
    ? "history.edit"
    : "history.style";
}

/** True when every key in the patch already holds that value. Arrays compare by JSON. */
function isNoOp(target: object, patch: object): boolean {
  const current = target as Record<string, unknown>;
  return Object.entries(patch).every(([key, next]) => {
    const now = current[key];
    if (now === next) return true;
    if (typeof now === "object" && typeof next === "object" && now !== null && next !== null) {
      return JSON.stringify(now) === JSON.stringify(next);
    }
    return false;
  });
}

export interface MailDesignerProps {
  value: MailDocument;
  onChange: (next: MailDocument) => void;

  /** The *editor's* appearance. The email's appearance lives in value.settings. */
  theme?: DesignerTheme;
  colorScheme?: ColorScheme;

  locale?: Locale;
  /** Override individual labels without touching i18next. */
  strings?: Strings;

  /** Tokens offered in the insert menus, e.g. ["Namn", "Ort"]. */
  mergeFields?: string[];
  /** Enables the file picker on image blocks. Without it, only a URL field is offered. */
  onUploadImage?: (file: File) => Promise<string>;
  /** Fills in a social icon URL from a network name, so users need not paste URLs. */
  resolveSocialIcon?: (network: string) => string;

  /** Replaces the built-in starting points. */
  presets?: MailPreset[];
  /** Rendered at the right end of the toolbar — where a template menu belongs. */
  toolbarExtra?: ReactNode;

  /**
   * Called whenever undo/redo availability changes, with the controls themselves.
   *
   * For hosts that want the history buttons in their own chrome rather than the editor's —
   * an app-wide toolbar, say. The built-in cluster stays regardless; hide it with
   * `showHistory={false}`.
   */
  onHistoryChange?: (history: HistoryControls) => void;
  /** Set false to render no history cluster and drive undo/redo from your own UI. */
  showHistory?: boolean;
  /** How many steps to keep. Default 200. */
  historyLimit?: number;

  className?: string;
}

/**
 * The editor.
 *
 * Controlled by design: `value` and `onChange` mean the host owns the document and can
 * persist it, diff it, or drive it from a store without this component holding a second
 * copy. Undo/redo covers every change made through the editor, and records a document the
 * host swaps in as a step of its own rather than discarding the history.
 */
export function MailDesigner({
  value,
  onChange,
  theme,
  colorScheme = "system",
  locale = "sv",
  strings,
  mergeFields = [],
  onUploadImage,
  resolveSocialIcon,
  toolbarExtra,
  onHistoryChange,
  showHistory = true,
  historyLimit = 200,
  className,
}: MailDesignerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("edit");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Derived, not stored: keeping a width in state meant it went stale the moment the user
  // changed the email's own width in the inspector.
  const viewportWidth = viewport === "mobile" ? MOBILE_WIDTH : value.settings.width;

  // One i18next instance per locale/overrides pair, never the global singleton.
  const t = useMemo(() => createTranslate(createI18n(locale, strings)), [locale, strings]);

  const history = useHistory(value, onChange, {
    limit: historyLimit,
    externalLabel: t("history.replace"),
  });
  const { commit } = history;

  // Let a host mirror the controls into its own chrome.
  useEffect(() => {
    onHistoryChange?.(history);
  }, [history, onHistoryChange]);

  /**
   * Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, captured at the editor root.
   *
   * Capture matters twice over. It beats the browser's own contenteditable undo, which would
   * otherwise restore DOM text the document model knows nothing about — the two histories
   * would drift apart within a few keystrokes. And rooting it on the editor rather than the
   * document means the shortcut belongs to the editor, not to the whole host application.
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey);
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      event.stopPropagation();
      if (isUndo) history.undo();
      else history.redo();
    };
    root.addEventListener("keydown", onKeyDown, { capture: true });
    return () => root.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [history]);

  // The drag layer sits between history and the canvas: it decides *where* a block lands,
  // and the same commit path applies it, so a drag is one undo step like any other edit.
  const { drag, startMove, startCreate } = useDragSort({
    canvasRef,
    getBlock: (id) => findBlock(value, id)?.block,
    onMove: (id, container, index) =>
      commit(moveBlock(value, id, { container, index }), { label: t("history.move") }),
    onCreate: (block, container, index) => {
      commit(insertBlock(value, block, { container, index }), { label: t("history.insert") });
      setSelectedId(block.id);
    },
  });

  const api = useMemo<EditorApi>(() => {
    const apply = (next: MailDocument, label: string, coalesceKey?: string): void =>
      commit(next, coalesceKey === undefined ? { label } : { label, coalesceKey });
    return {
      doc: value,
      selectedId,
      select: (id) => {
        // Moving the selection closes the merge run: whatever the user does next is a new
        // edit, even if it touches the same property as before.
        if (id !== selectedId) history.breakRun();
        setSelectedId(id);
      },
      t,
      mergeFields,
      onUploadImage,
      resolveSocialIcon,
      update: (id, patch) => {
        const found = findBlock(value, id);
        // A control that re-emits its current value — a blur, a re-render, a colour picker
        // settling on the shade it started from — must not leave an undo step behind.
        if (found && isNoOp(found.block, patch)) return;
        apply(
          updateBlock(value, id, patch as Partial<Block>),
          t(describeUpdate(patch)),
          // Keyed on the block *and* the fields: typing merges, but moving to another block
          // or another property starts a fresh step.
          `update:${id}:${Object.keys(patch).sort().join(",")}`,
        );
      },
      updateSettings: (patch: Partial<MailSettings>) => {
        if (isNoOp(value.settings, patch)) return;
        apply(
          updateSettingsIn(value, patch),
          t("history.settings"),
          `settings:${Object.keys(patch).sort().join(",")}`,
        );
      },
      updateColumn: (columnId, patch: Partial<Omit<MailColumn, "id" | "children">>) =>
        apply(
          updateColumnIn(value, columnId, patch),
          t("history.column"),
          `column:${columnId}:${Object.keys(patch).sort().join(",")}`,
        ),
      insert: (block: Block, position: Position) =>
        apply(insertBlock(value, block, position), t("history.insert")),
      remove: (id) => apply(removeBlock(value, id), t("history.remove")),
      duplicate: (id) => apply(duplicateBlockIn(value, id), t("history.duplicate")),
      move: (id, position) => apply(moveBlock(value, id, position), t("history.move")),
      replaceDocument: (next) => apply(next, t("history.replace")),
      endEdit: history.breakRun,
      startBlockDrag: startMove,
      isDragging: drag !== null,
      viewportWidth,
      isMobileViewport: viewport === "mobile",
      history,
    };
  }, [
    value,
    selectedId,
    t,
    mergeFields,
    onUploadImage,
    resolveSocialIcon,
    commit,
    history,
    startMove,
    drag,
    viewportWidth,
    viewport,
  ]);

  return (
    <div
      ref={rootRef}
      className={`md-root${className ? ` ${className}` : ""}`}
      data-color-scheme={resolveColorScheme(colorScheme)}
      style={themeToStyle(theme)}
    >
      <EditorProvider api={api}>
        <Toolbar
          view={view}
          onViewChange={setView}
          viewport={viewport}
          onViewportChange={setViewport}
          showHistory={showHistory}
          extra={toolbarExtra}
        />
        {/* Preview renders a single child, so the three-column grid has to collapse with it
            — otherwise the frame lands in the 176px palette column. */}
        <div className={`md-layout${view === "preview" ? " md-layout--preview" : ""}`}>
          {view === "edit" ? <Palette onDragStart={startCreate} /> : null}
          {view === "edit" ? (
            <Canvas canvasRef={canvasRef} dropTarget={drag?.target ?? null} />
          ) : (
            <PreviewFrame doc={value} width={viewportWidth} />
          )}
          {view === "edit" ? <Inspector /> : null}
        </div>
      </EditorProvider>
    </div>
  );
}
