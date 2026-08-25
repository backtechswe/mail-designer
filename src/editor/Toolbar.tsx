import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import { HistoryBar } from "./HistoryBar.js";
import type { ReactNode } from "react";

export type ViewMode = "edit" | "preview";
export type Viewport = "desktop" | "mobile";

export function Toolbar({
  view,
  onViewChange,
  viewport,
  onViewportChange,
  showHistory = true,
  extra,
}: {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  showHistory?: boolean;
  /** Host-supplied controls — the template menu lands here. */
  extra?: ReactNode;
}) {
  const { t } = useEditor();

  return (
    <div className="md-toolbar">
      {showHistory ? <HistoryBar /> : null}

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

      {/* Applies to the canvas as well as the preview: switching to mobile while editing
          is how you check that a design still works there, so it must not yank the user
          out of edit mode to do it. */}
      <div className="md-toolbar-group md-segmented">
        <button
          type="button"
          aria-pressed={viewport === "desktop"}
          title={t("toolbar.desktop")}
          aria-label={t("toolbar.desktop")}
          onClick={() => onViewportChange("desktop")}
        >
          <Icon name="desktop" size={13} />
        </button>
        <button
          type="button"
          aria-pressed={viewport === "mobile"}
          title={t("toolbar.mobile")}
          aria-label={t("toolbar.mobile")}
          onClick={() => onViewportChange("mobile")}
        >
          <Icon name="mobile" size={13} />
        </button>
      </div>

      <div className="md-toolbar-spacer" />
      {extra}
    </div>
  );
}
