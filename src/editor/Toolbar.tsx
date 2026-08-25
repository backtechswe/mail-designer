import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import type { ReactNode } from "react";

export type ViewMode = "edit" | "preview";

export function Toolbar({
  view,
  onViewChange,
  width,
  onWidthChange,
  extra,
}: {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  width: number;
  onWidthChange: (width: number) => void;
  /** Host-supplied controls — the template menu lands here. */
  extra?: ReactNode;
}) {
  const { doc, history, t } = useEditor();
  const desktopWidth = doc.settings.width;

  return (
    <div className="md-toolbar">
      <div className="md-toolbar-group">
        <button
          type="button"
          title={t("toolbar.undo")}
          aria-label={t("toolbar.undo")}
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Icon name="undo" size={13} />
        </button>
        <button
          type="button"
          title={t("toolbar.redo")}
          aria-label={t("toolbar.redo")}
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Icon name="redo" size={13} />
        </button>
      </div>

      <div className="md-toolbar-group md-segmented">
        <button type="button" aria-pressed={view === "edit"} onClick={() => onViewChange("edit")}>
          <Icon name="section" size={12} />
          {t("toolbar.edit")}
        </button>
        <button
          type="button"
          aria-pressed={view === "preview"}
          onClick={() => onViewChange("preview")}
        >
          <Icon name="eye" size={12} />
          {t("toolbar.preview")}
        </button>
      </div>

      <div className="md-toolbar-group md-segmented">
        <button
          type="button"
          aria-pressed={width >= desktopWidth}
          title={t("toolbar.desktop")}
          aria-label={t("toolbar.desktop")}
          onClick={() => onWidthChange(desktopWidth)}
        >
          <Icon name="desktop" size={13} />
        </button>
        <button
          type="button"
          aria-pressed={width < desktopWidth}
          title={t("toolbar.mobile")}
          aria-label={t("toolbar.mobile")}
          onClick={() => onWidthChange(375)}
        >
          <Icon name="mobile" size={13} />
        </button>
      </div>

      <div className="md-toolbar-spacer" />
      {extra}
    </div>
  );
}
