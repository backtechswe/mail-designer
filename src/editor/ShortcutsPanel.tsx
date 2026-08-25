import { useEffect } from "react";
import { useEditor } from "./EditorContext.js";
import type { StringKey } from "../i18n.js";

const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");

/** ⌘ on Apple, Ctrl elsewhere — shown as the user's own keyboard reads. */
export const MOD = IS_APPLE ? "⌘" : "Ctrl";

const SHORTCUTS: { keys: string[]; label: StringKey }[] = [
  { keys: [MOD, "Z"], label: "shortcuts.undo" },
  { keys: ["⇧", MOD, "Z"], label: "shortcuts.redo" },
  { keys: [MOD, "S"], label: "shortcuts.save" },
  { keys: [MOD, "D"], label: "shortcuts.duplicate" },
  { keys: [MOD, "E"], label: "shortcuts.preview" },
  { keys: ["Delete"], label: "shortcuts.delete" },
  { keys: ["Esc"], label: "shortcuts.selectParent" },
  { keys: ["Alt", "↑", "↓"], label: "shortcuts.move" },
  { keys: ["Alt", "←", "→"], label: "shortcuts.moveAcross" },
  { keys: ["?"], label: "shortcuts.help" },
];

/**
 * The shortcut list. Worth having as a panel rather than only tooltips: shortcuts people
 * cannot discover are shortcuts nobody uses, and a keyboard-first editor that hides its own
 * keyboard is a contradiction.
 */
export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useEditor();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="md-dialog-scrim" onClick={onClose}>
      <div
        className="md-dialog md-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-label={t("shortcuts.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("shortcuts.title")}</h3>
        <dl className="md-shortcuts">
          {SHORTCUTS.map((row) => (
            <div key={row.label}>
              <dt>
                {row.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{t(row.label)}</dd>
            </div>
          ))}
        </dl>
        <div className="md-dialog-actions">
          <button type="button" className="md-dialog-primary" onClick={onClose}>
            {t("action.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
