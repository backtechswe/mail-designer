import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";

/**
 * Undo and redo, in a place of their own.
 *
 * Deliberately set apart from the view and viewport controls: history acts on the whole
 * document, not on the panel it happens to sit above, and a control grouped with the
 * preview toggle reads as belonging to the preview. It gets its own recessed surface, its
 * own rule, and it names the step — "Ångra: Flyttade ett block" — because a global history
 * that will not say what it is about to reverse is a history people stop trusting.
 */
export function HistoryBar() {
  const { history, t } = useEditor();

  const undoTitle = history.undoLabel
    ? t("history.undoAction", { action: history.undoLabel })
    : t("history.undoNothing");
  const redoTitle = history.redoLabel
    ? t("history.redoAction", { action: history.redoLabel })
    : t("history.redoNothing");

  return (
    <div className="md-history" role="group" aria-label={t("history.title")}>
      <button
        type="button"
        title={undoTitle}
        aria-label={undoTitle}
        disabled={!history.canUndo}
        onClick={history.undo}
      >
        <Icon name="undo" size={13} />
      </button>
      <button
        type="button"
        title={redoTitle}
        aria-label={redoTitle}
        disabled={!history.canRedo}
        onClick={history.redo}
      >
        <Icon name="redo" size={13} />
      </button>
      {/* aria-hidden: the same text is already on the buttons, and announcing it twice on
          every change would make the editor noisy for a screen-reader user. */}
      <span className="md-history-label" aria-hidden>
        {history.undoLabel ?? ""}
      </span>
    </div>
  );
}
