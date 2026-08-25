import { useCallback, useMemo, useRef, useState } from "react";
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
import { resolveColorScheme, themeToStyle } from "./editor/theme.js";
import { Canvas } from "./editor/Canvas.js";
import { Palette } from "./editor/Palette.js";
import { Inspector } from "./editor/Inspector.js";
import { PreviewFrame } from "./editor/PreviewFrame.js";
import { Toolbar } from "./editor/Toolbar.js";
import type { ViewMode } from "./editor/Toolbar.js";
import { useDragSort } from "./editor/dnd/useDragSort.js";

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

  className?: string;
}

/**
 * The editor.
 *
 * Controlled by design: `value` and `onChange` mean the host owns the document and can
 * persist it, diff it, or drive it from a store without this component holding a second
 * copy. Undo/redo tracks the changes it produced (see useHistory) and resets when the host
 * swaps the document out from under it.
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
  className,
}: MailDesignerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("edit");
  const [previewWidth, setPreviewWidth] = useState(value.settings.width);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // One i18next instance per locale/overrides pair, never the global singleton.
  const t = useMemo(() => createTranslate(createI18n(locale, strings)), [locale, strings]);

  const history = useHistory(value, onChange);
  const { commit } = history;

  // The drag layer sits between history and the canvas: it decides *where* a block lands,
  // and the same commit path applies it, so a drag is one undo step like any other edit.
  const { drag, startMove, startCreate } = useDragSort({
    canvasRef,
    getBlock: (id) => findBlock(value, id)?.block,
    onMove: (id, container, index) => commit(moveBlock(value, id, { container, index })),
    onCreate: (block, container, index) => {
      commit(insertBlock(value, block, { container, index }));
      setSelectedId(block.id);
    },
  });

  const api = useMemo<EditorApi>(() => {
    const apply = (next: MailDocument, coalesce = false): void => commit(next, coalesce);
    return {
      doc: value,
      selectedId,
      select: setSelectedId,
      t,
      mergeFields,
      onUploadImage,
      resolveSocialIcon,
      update: (id, patch, coalesce) => apply(updateBlock(value, id, patch as Partial<Block>), coalesce),
      updateSettings: (patch: Partial<MailSettings>, coalesce) =>
        apply(updateSettingsIn(value, patch), coalesce),
      updateColumn: (columnId, patch: Partial<Omit<MailColumn, "id" | "children">>) =>
        apply(updateColumnIn(value, columnId, patch)),
      insert: (block: Block, position: Position) => apply(insertBlock(value, block, position)),
      remove: (id) => apply(removeBlock(value, id)),
      duplicate: (id) => apply(duplicateBlockIn(value, id)),
      move: (id, position) => apply(moveBlock(value, id, position)),
      replaceDocument: (next) => apply(next),
      startBlockDrag: startMove,
      isDragging: drag !== null,
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
  ]);

  const handleWidth = useCallback((width: number) => {
    setPreviewWidth(width);
    setView((current) => (current === "edit" ? "preview" : current));
  }, []);

  return (
    <div
      className={`md-root${className ? ` ${className}` : ""}`}
      data-color-scheme={resolveColorScheme(colorScheme)}
      style={themeToStyle(theme)}
    >
      <EditorProvider api={api}>
        <Toolbar
          view={view}
          onViewChange={setView}
          width={previewWidth}
          onWidthChange={handleWidth}
          extra={toolbarExtra}
        />
        <div className="md-layout">
          {view === "edit" ? <Palette onDragStart={startCreate} /> : null}
          {view === "edit" ? (
            <Canvas canvasRef={canvasRef} dropTarget={drag?.target ?? null} />
          ) : (
            <PreviewFrame doc={value} width={previewWidth} />
          )}
          {view === "edit" ? <Inspector /> : null}
        </div>
      </EditorProvider>
    </div>
  );
}
