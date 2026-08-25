import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import { HistoryBar } from "./HistoryBar.js";
import type { ReactNode } from "react";

export type ViewMode = "edit" | "preview" | "code";
export type Viewport = "desktop" | "tablet" | "phone";

export function Toolbar({
  view,
  onViewChange,
  showCode = true,
  viewport,
  onViewportChange,
  showHistory = true,
  onOpenShortcuts,
  dataOpen,
  onToggleData,
  mockup,
  onToggleMockup,
  extra,
}: {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** False hides the code view entirely — see permissions.code. */
  showCode?: boolean;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  showHistory?: boolean;
  onOpenShortcuts?: () => void;
  /** Present when the data panel is available. */
  dataOpen?: boolean;
  onToggleData?: () => void;
  /** Present in preview mode, where a device outline is meaningful. */
  mockup?: boolean;
  onToggleMockup?: () => void;
  /** Host-supplied controls — the template menu lands here. */
  extra?: ReactNode;
}) {
  const { t } = useEditor();

  return (
    <div className="md-toolbar">
      {showHistory ? <HistoryBar /> : null}

      <div className="md-toolbar-group md-segmented">
        <button type="button" aria-pressed={view === "edit"} onClick={() => onViewChange("edit")}>
          <Icon name="edit" size={12} />
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
        {showCode ? (
          <button
            type="button"
            aria-pressed={view === "code"}
            onClick={() => onViewChange("code")}
          >
            <Icon name="code" size={12} />
            {t("toolbar.code")}
          </button>
        ) : null}
      </div>

      {/* Applies to the canvas as well as the preview: checking a design at phone width while
          editing it must not yank the user out of edit mode. Hidden in the code view, where
          the output is one string and a width would be a control that does nothing. */}
      <div
        className="md-toolbar-group md-segmented"
        hidden={view === "code"}
      >
        {(
          [
            ["desktop", "desktop", "toolbar.desktop"],
            ["tablet", "tablet", "toolbar.tablet"],
            ["phone", "mobile", "toolbar.phone"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={viewport === id}
            title={t(label)}
            aria-label={t(label)}
            onClick={() => onViewportChange(id)}
          >
            <Icon name={icon} size={13} />
          </button>
        ))}
      </div>

      {onToggleMockup ? (
        <div className="md-toolbar-group md-segmented">
          <button
            type="button"
            aria-pressed={mockup}
            title={t("toolbar.mockup")}
            aria-label={t("toolbar.mockup")}
            onClick={onToggleMockup}
          >
            <Icon name="frame" size={13} />
          </button>
        </div>
      ) : null}

      {onToggleData ? (
        <div className="md-toolbar-group md-segmented">
          <button type="button" aria-pressed={dataOpen} onClick={onToggleData}>
            <Icon name="code" size={12} />
            {t("data.panel")}
          </button>
        </div>
      ) : null}

      <div className="md-toolbar-spacer" />
      {extra}
      {onOpenShortcuts ? (
        <button
          type="button"
          className="md-help-button"
          title={t("shortcuts.open")}
          aria-label={t("shortcuts.open")}
          onClick={onOpenShortcuts}
        >
          ?
        </button>
      ) : null}
    </div>
  );
}
