import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  Block,
  BlockType,
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
  emptyDocument,
  findBlock,
  insertBlock,
  parentOf,
  moveBlock,
  removeBlock,
  updateBlock,
  updateColumn as updateColumnIn,
  updateSettings as updateSettingsIn,
} from "./document.js";
import { createI18n, createTranslate } from "./i18n.js";
import type { StringKey, Strings } from "./i18n.js";
import { EditorProvider } from "./editor/EditorContext.js";
import type { EditorApi } from "./editor/EditorContext.js";
import { useHistory } from "./editor/useHistory.js";
import type { HistoryControls } from "./editor/useHistory.js";
import { resolveColorScheme, themeToStyle } from "./editor/theme.js";
import { Canvas } from "./editor/Canvas.js";
import { Palette } from "./editor/Palette.js";
import { Inspector } from "./editor/Inspector.js";
import { PreviewFrame } from "./editor/PreviewFrame.js";
import { CodeView } from "./editor/CodeView.js";
import { DEVICES } from "./editor/devices.js";
import { compressImage } from "./editor/compress.js";
import { CustomisationProvider } from "./editor/customise.js";
import type { EditorCustomisation } from "./editor/customise.js";
import type { CompressOptions, CompressResult } from "./editor/compress.js";
import { ConfirmDialog } from "./editor/ConfirmDialog.js";
import type { ConfirmRequest } from "./editor/ConfirmDialog.js";
import { ShortcutsPanel } from "./editor/ShortcutsPanel.js";
import { DocumentBar } from "./session/DocumentBar.js";
import { useDocumentSession } from "./session/useDocumentSession.js";
import { duplicateBlock as duplicateFor } from "./document.js";
import type { TemplateStore } from "./templates.js";
import { DataPanel } from "./data/DataPanel.js";
import { blockCapabilities, resolvePermissions } from "./permissions.js";
import type { Permissions } from "./permissions.js";
import { extractDataFields } from "./render/dataFields.js";
import { Toolbar } from "./editor/Toolbar.js";
import type { ViewMode, Viewport } from "./editor/Toolbar.js";
import { useDragSort } from "./editor/dnd/useDragSort.js";

/** Stable empty object, so an omitted `customise` prop does not re-render every consumer. */
const EMPTY_CUSTOMISATION: EditorCustomisation = {};

/** 1 / 2 / 3 switch viewport, left to right, in the same order as the toolbar's own buttons. */
const VIEWPORT_KEYS: Record<string, Viewport | undefined> = {
  "1": "desktop",
  "2": "tablet",
  "3": "phone",
};

/** Fields whose change is content the reader will see, rather than styling. */
const CONTENT_FIELDS = new Set([
  "html",
  "label",
  "src",
  "alt",
  "href",
  "items",
  "level",
]);

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
    if (
      typeof now === "object" &&
      typeof next === "object" &&
      now !== null &&
      next !== null
    ) {
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

  /**
   * Sample values for the preview, keyed by field name. Controlled when `onDataChange` is
   * given, otherwise the editor holds them itself.
   *
   * Kept out of the document on purpose: this is example data for designing against, while
   * the real values arrive per recipient at send time. A host that wants it persisted can put
   * it in the template's `meta`.
   */
  data?: Record<string, string>;
  onDataChange?: (next: Record<string, string>) => void;

  /**
   * What the user may do. Everything defaults to permitted.
   *
   * ```tsx
   * // The application owns the copy and the data; the user arranges the layout.
   * permissions={{ content: false, data: "readonly", requiredFields: ["Date", "Time"] }}
   * ```
   */
  permissions?: Permissions;

  /**
   * The document a "reset to default" returns to. Shown in the document bar when given.
   * It is an edit to the open document, so it can be undone.
   */
  resetTo?: MailDocument;
  /** Enables the file picker on image blocks. Without it, only a URL field is offered. */
  onUploadImage?: (file: File) => Promise<string>;

  /**
   * Shrink images before `onUploadImage` sees them. On by default.
   *
   * The person adding a picture is holding a 4000px photo and the column is 600px wide, and
   * nothing between those facts fixes itself. `false` hands the original file straight
   * through — right when the host wants to do its own processing server-side.
   */
  imageCompression?: false | CompressOptions;
  /** Fills in a social icon URL from a network name, so users need not paste URLs. */
  resolveSocialIcon?: (network: string) => string;

  /**
   * Who the device mock says the mail is from, and when.
   *
   * Editor chrome only — it is never rendered into the mail, and never sent. Worth setting to
   * the address the mailing will actually go out from: a sender line is part of what the
   * recipient reads before deciding to open anything.
   */
  previewIdentity?: { name?: string; email?: string; date?: string };

  /**
   * Make it look like your application.
   *
   * `classNames` attaches your classes to a named part — Tailwind's utilities land here — and
   * `icons` swaps a glyph for your own. Our classes stay and yours are appended, so a single
   * class of yours beats the corresponding rule in styles.css: the base rules are wrapped in
   * `:where()` for exactly that reason, and nothing here needs `!important`.
   *
   * ```tsx
   * customise={{
   *   classNames: { button: "rounded-md bg-indigo-600 text-white", panel: "shadow-xl" },
   *   icons: { trash: MyTrashIcon },
   * }}
   * ```
   */
  customise?: EditorCustomisation;

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

  /**
   * Give the editor a store and it manages the document session itself: a name bar, autosave,
   * a switcher, and the prompts that go with them.
   *
   * The record is created on the first edit rather than on load, so there is something to
   * save against as soon as the user starts working without filling the store with empty
   * drafts. Omit the store and the editor is a plain controlled component.
   */
  store?: TemplateStore;
  /** Open this document on mount. */
  documentId?: string;
  /** Quiet period after the last edit before autosaving. Default 1200 ms. */
  autosaveMs?: number;

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
  // English by default: the fallback, the documentation's language, and the only resource in
  // the main bundle. A Swedish default meant every consumer who set nothing shipped a Swedish
  // editor and `<html lang="sv">` on every mail.
  locale = "en",
  strings,
  data: dataProp,
  onDataChange,
  permissions: permissionsProp,
  resetTo,
  onUploadImage,
  resolveSocialIcon,
  imageCompression,
  customise,
  previewIdentity,
  toolbarExtra,
  onHistoryChange,
  showHistory = true,
  historyLimit = 200,
  store,
  documentId,
  autosaveMs,
  className,
}: MailDesignerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("edit");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [ownData, setOwnData] = useState<Record<string, string>>(
    dataProp ?? {},
  );
  const [dataOpen, setDataOpen] = useState(false);
  const [mockup, setMockup] = useState(false);

  const permissions = useMemo(
    () => resolvePermissions(permissionsProp),
    [permissionsProp],
  );
  const data = dataProp ?? ownData;
  const setData = onDataChange ?? setOwnData;

  /**
   * Field names offered in the insert menus: the sample data's own keys plus anything the
   * document already refers to. Adding a key to the data is therefore all it takes to make a
   * new field insertable — which is the behaviour asked for, and it means the two never drift.
   */
  const dataFields = useMemo(() => {
    const fromDoc = extractDataFields(value);
    const seen = new Set<string>();
    return [...Object.keys(data), ...fromDoc].filter((f) => {
      const key = f.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data, value]);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Derived, not stored: keeping a width in state meant it went stale the moment the user
  // changed the email's own width in the inspector.
  // Real device widths (see devices.ts), so the mail's own media queries fire exactly as they
  // would on the device. Desktop without a frame is the mail's own width, because a bare
  // preview has no client around it to be a fraction of.
  const viewportWidth =
    viewport === "desktop" && !mockup
      ? value.settings.width
      : DEVICES[viewport].content;

  // One i18next instance per locale/overrides pair, never the global singleton.
  const t = useMemo(
    () => createTranslate(createI18n(locale, strings)),
    [locale, strings],
  );

  /*
   * Bound to the mail's own width: twice the content width is what a retina screen uses, and
   * anything past that is bytes nobody sees. Rebuilt when the width changes, so widening the
   * mail widens what new uploads keep.
   */
  const compress = useMemo(() => {
    if (imageCompression === false) return undefined;
    const options: CompressOptions = {
      maxWidth: value.settings.width * 2,
      ...(imageCompression ?? {}),
    };
    return (file: File): Promise<CompressResult> =>
      compressImage(file, options);
  }, [imageCompression, value.settings.width]);

  const identity = useMemo(
    () => ({
      name: previewIdentity?.name ?? t("client.sender"),
      email: previewIdentity?.email ?? t("client.senderEmail"),
      date: previewIdentity?.date ?? t("client.date"),
    }),
    [previewIdentity, t],
  );

  const history = useHistory(value, onChange, {
    limit: historyLimit,
    externalLabel: t("history.replace"),
  });
  const { commit } = history;

  const session = useDocumentSession({
    value,
    load: history.load,
    store,
    initialId: documentId,
    ...(autosaveMs === undefined ? {} : { autosaveMs }),
    untitledTemplate: t("session.untitled"),
    locale,
  });

  /**
   * Guards a step that would discard work. Autosave keeps the window short, but it is not
   * zero — a save can be in flight, or have failed — and switching documents cannot be
   * undone, so it is the one place a prompt genuinely earns its interruption.
   */
  const guard = (request: ConfirmRequest, needed: boolean): void => {
    if (!needed) {
      request.onConfirm();
      return;
    }
    setConfirmRequest(request);
  };

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
      // The unmodified keys. Cheap to reach, so they are the ones worth having for things you
      // do dozens of times an hour — but only when the keystroke is not text being typed.
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const typing =
          target?.isContentEditable ||
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT";

        if (event.key === "?" && !typing) {
          event.preventDefault();
          setShortcutsOpen(true);
          return;
        }

        const asViewport = VIEWPORT_KEYS[event.key];
        if (asViewport && !typing) {
          event.preventDefault();
          setViewport(asViewport);
          return;
        }

        if (event.key.toLowerCase() === "m" && !typing) {
          event.preventDefault();
          setMockup((on) => !on);
          // A device frame around the editing canvas would mean nothing, so the key implies
          // the mode it belongs to rather than silently doing nothing.
          setView("preview");
          return;
        }
      }

      if (event.key === "Escape" && !shortcutsOpen && !confirmRequest) {
        // Steps out one level rather than clearing outright: "zoom out" is more often what is
        // wanted, and it is the only keyboard route to a block that another block covers.
        const parent = selectedId ? parentOf(value, selectedId) : null;
        setSelectedId(parent ? parent.id : null);
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        history.undo();
        return;
      }
      if ((key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        history.redo();
        return;
      }
      if (key === "s") {
        // Also stops the browser's own save dialog, which is never what was meant here.
        event.preventDefault();
        event.stopPropagation();
        void session.saveNow();
        return;
      }
      if (key === "d" && selectedId && permissions.structure) {
        event.preventDefault();
        event.stopPropagation();
        commit(duplicateFor(value, selectedId), {
          label: stepLabel(
            "history.duplicate",
            findBlock(value, selectedId)?.block,
          ),
        });
        return;
      }
      if (key === "e") {
        event.preventDefault();
        event.stopPropagation();
        setView((current) => (current === "edit" ? "preview" : "edit"));
      }
    };

    root.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      root.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    history,
    session,
    selectedId,
    value,
    commit,
    t,
    shortcutsOpen,
    confirmRequest,
    permissions.structure,
  ]);

  /**
   * Names the block a step acted on, so the history menu is a list of distinguishable
   * changes rather than six lines of "Added a block". Read before the change is applied,
   * because after a removal there is nothing left to name.
   */
  const stepLabel = useCallback(
    (
      key:
        | "history.insert"
        | "history.remove"
        | "history.duplicate"
        | "history.move",
      block: Block | BlockType | undefined,
    ) => {
      const type = typeof block === "string" ? block : block?.type;
      return t(key, {
        block: type ? t(`block.${type}` as StringKey) : t("block.section"),
      });
    },
    [t],
  );

  /**
   * Warn before leaving with work the store has not accepted. The browser shows its own
   * wording; all we control is whether it asks at all, so it must only ask when true.
   */
  useEffect(() => {
    if (!store || !session.hasUnsavedWork) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [store, session.hasUnsavedWork]);

  // The drag layer sits between history and the canvas: it decides *where* a block lands,
  // and the same commit path applies it, so a drag is one undo step like any other edit.
  const { drag, startMove, startCreate } = useDragSort({
    canvasRef,
    getBlock: (id) => {
      const block = findBlock(value, id)?.block;
      // A locked block is not draggable: refusing here means no drop indicator ever appears
      // for it, rather than a drag that silently does nothing on release.
      if (!block || !blockCapabilities(block, permissions).move)
        return undefined;
      return block;
    },
    onMove: (id, container, index) =>
      commit(moveBlock(value, id, { container, index }), {
        label: stepLabel("history.move", findBlock(value, id)?.block),
      }),
    onCreate: (block, container, index) => {
      commit(insertBlock(value, block, { container, index }), {
        label: stepLabel("history.insert", block),
      });
      setSelectedId(block.id);
    },
  });

  const api = useMemo<EditorApi>(() => {
    const apply = (
      next: MailDocument,
      label: string,
      coalesceKey?: string,
    ): void =>
      commit(
        next,
        coalesceKey === undefined ? { label } : { label, coalesceKey },
      );
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
      dataFields,
      data,
      setData,
      insertDataField: (field) => {
        // Appending is the honest fallback: the caret lives inside a contenteditable this
        // component does not own, and guessing at a position would drop the token somewhere
        // the user did not ask for.
        if (!selectedId) return;
        const found = findBlock(value, selectedId);
        if (!found) return;
        const block = found.block as { html?: string; label?: string };
        const patch =
          typeof block.html === "string"
            ? { html: `${block.html} [${field}]` }
            : typeof block.label === "string"
              ? { label: `${block.label} [${field}]` }
              : null;
        if (!patch) return;
        commit(updateBlock(value, selectedId, patch as Partial<Block>), {
          label: t("history.edit"),
        });
      },
      permissions,
      capabilities: (block) => blockCapabilities(block, permissions),
      onUploadImage,
      compressImage: compress,
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
      updateColumn: (
        columnId,
        patch: Partial<Omit<MailColumn, "id" | "children">>,
      ) =>
        apply(
          updateColumnIn(value, columnId, patch),
          t("history.column"),
          `column:${columnId}:${Object.keys(patch).sort().join(",")}`,
        ),
      insert: (block: Block, position: Position) =>
        apply(
          insertBlock(value, block, position),
          stepLabel("history.insert", block),
        ),
      remove: (id) =>
        apply(
          removeBlock(value, id),
          stepLabel("history.remove", findBlock(value, id)?.block),
        ),
      duplicate: (id) =>
        apply(
          duplicateBlockIn(value, id),
          stepLabel("history.duplicate", findBlock(value, id)?.block),
        ),
      move: (id, position) =>
        apply(
          moveBlock(value, id, position),
          stepLabel("history.move", findBlock(value, id)?.block),
        ),
      replaceDocument: (next) => apply(next, t("history.replace")),
      endEdit: history.breakRun,
      confirm: setConfirmRequest,
      startBlockDrag: startMove,
      isDragging: drag !== null,
      viewportWidth,
      // Keyed on the actual width against the media query's own breakpoint, not on the
      // viewport name: a 768px tablet does not stack a 600px mail, and a 900px mail would
      // stack on a tablet. The canvas has to agree with the CSS, not with the label.
      isMobileViewport: viewportWidth < value.settings.width - 20,
      history,
    };
  }, [
    value,
    selectedId,
    t,
    dataFields,
    onUploadImage,
    compress,
    resolveSocialIcon,
    commit,
    history,
    startMove,
    drag,
    viewportWidth,
    viewport,
    data,
    setData,
    dataFields,
    permissions,
  ]);

  return (
    <div
      ref={rootRef}
      className={`md-root${className ? ` ${className}` : ""}${
        customise?.classNames?.root ? ` ${customise.classNames.root}` : ""
      }`}
      data-color-scheme={resolveColorScheme(colorScheme)}
      style={themeToStyle(theme)}
    >
      <CustomisationProvider value={customise ?? EMPTY_CUSTOMISATION}>
        <EditorProvider api={api}>
          {store ? (
            <DocumentBar
              session={session}
              onNew={() =>
                guard(
                  {
                    title: t("confirm.newDocumentTitle"),
                    body: t("confirm.newDocumentBody"),
                    confirmLabel: t("confirm.newDocumentOk"),
                    onConfirm: () => session.startNew(emptyDocument()),
                  },
                  session.hasUnsavedWork,
                )
              }
              onOpen={(id, name) =>
                guard(
                  {
                    title: t("confirm.switchDocumentTitle", { name }),
                    body: t("confirm.switchDocumentBody"),
                    confirmLabel: t("confirm.switchDocumentOk"),
                    onConfirm: () => void session.open(id),
                  },
                  session.hasUnsavedWork,
                )
              }
              {...(resetTo
                ? {
                    onReset: () =>
                      setConfirmRequest({
                        title: t("confirm.resetTitle"),
                        body: t("confirm.resetBody"),
                        confirmLabel: t("confirm.resetOk"),
                        onConfirm: () => {
                          commit(structuredClone(resetTo), {
                            label: t("session.reset"),
                          });
                          setSelectedId(null);
                        },
                      }),
                  }
                : {})}
              canManage={permissions.manageDocuments}
              onDelete={(id, name) =>
                setConfirmRequest({
                  title: t("confirm.deleteDocumentTitle", { name }),
                  body: t("confirm.deleteDocumentBody"),
                  confirmLabel: t("confirm.deleteDocumentOk"),
                  destructive: true,
                  onConfirm: () => void session.remove(id),
                })
              }
            />
          ) : null}
          <Toolbar
            view={view}
            onViewChange={setView}
            viewport={viewport}
            onViewportChange={setViewport}
            showHistory={showHistory && permissions.history}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            {...(permissions.data === "hidden"
              ? {}
              : { dataOpen, onToggleData: () => setDataOpen((v) => !v) })}
            showCode={
              permissions.code.html ||
              permissions.code.text ||
              permissions.code.json
            }
            {...(view === "preview"
              ? { mockup, onToggleMockup: () => setMockup((v) => !v) }
              : {})}
            extra={permissions.templates ? toolbarExtra : null}
          />
          {/* Preview renders a single child, so the three-column grid has to collapse with it
            — otherwise the frame lands in the 176px palette column. */}
          <div
            className={`md-layout${view === "edit" ? "" : " md-layout--preview"}`}
          >
            {view === "edit" ? <Palette onDragStart={startCreate} /> : null}
            {view === "edit" ? (
              <Canvas canvasRef={canvasRef} dropTarget={drag?.target ?? null} />
            ) : view === "code" ? (
              <CodeView />
            ) : (
              <PreviewFrame
                doc={value}
                width={viewportWidth}
                data={data}
                viewport={viewport}
                mockup={mockup}
                identity={identity}
              />
            )}
            {view === "edit" ? <Inspector /> : null}
          </div>
          {dataOpen && permissions.data !== "hidden" ? (
            <DataPanel onClose={() => setDataOpen(false)} />
          ) : null}
          <ConfirmDialog
            request={confirmRequest}
            onCancel={() => setConfirmRequest(null)}
          />
          <ShortcutsPanel
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
        </EditorProvider>
      </CustomisationProvider>
    </div>
  );
}
