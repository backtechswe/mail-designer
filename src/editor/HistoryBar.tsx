import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryStep } from "./history.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import { useSlot } from "./customise.js";

/** How long the pointer must rest on a button before its menu opens. */
const OPEN_DELAY_MS = 400;
/** Grace period when the pointer leaves, so crossing a corner does not shut the menu. */
const CLOSE_DELAY_MS = 180;

/**
 * Undo and redo, in a place of their own.
 *
 * Deliberately set apart from the view and viewport controls: history acts on the whole
 * document, not on the panel it happens to sit above, and a control grouped with the preview
 * toggle reads as belonging to the preview.
 *
 * Two plain icon buttons, not a segmented control — a segmented control means "one of these
 * is the current state", and neither undo nor redo is a state. Resting on either one opens
 * the last ten steps, so going back six changes is one gesture rather than six clicks, and
 * the label that used to sit beside the buttons is now on the step it belongs to.
 */
export function HistoryBar() {
  const { history, t } = useEditor();
  const [open, setOpen] = useState<"undo" | "redo" | null>(null);

  // Escape and click-outside, so it behaves like every other menu in the host app.
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open]);

  return (
    <div className="md-history" role="group" aria-label={t("history.title")} ref={root}>
      <HistoryButton
        direction="undo"
        icon="undo"
        steps={history.undoSteps}
        label={
          history.undoLabel
            ? t("history.undoAction", { action: history.undoLabel })
            : t("history.undoNothing")
        }
        heading={t("history.undoMenu")}
        open={open === "undo"}
        onOpenChange={(next) => setOpen(next ? "undo" : null)}
        onStep={history.undo}
      />
      <HistoryButton
        direction="redo"
        icon="redo"
        steps={history.redoSteps}
        label={
          history.redoLabel
            ? t("history.redoAction", { action: history.redoLabel })
            : t("history.redoNothing")
        }
        heading={t("history.redoMenu")}
        open={open === "redo"}
        onOpenChange={(next) => setOpen(next ? "redo" : null)}
        onStep={history.redo}
      />
    </div>
  );
}

function HistoryButton({
  direction,
  icon,
  steps,
  label,
  heading,
  open,
  onOpenChange,
  onStep,
}: {
  direction: "undo" | "redo";
  icon: "undo" | "redo";
  steps: HistoryStep[];
  label: string;
  heading: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStep: (count: number) => void;
}) {
  const { t } = useEditor();
  const slot = useSlot();
  const timer = useRef<number | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const disabled = steps.length === 0;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const schedule = useCallback(
    (next: boolean, delay: number) => {
      clearTimer();
      timer.current = window.setTimeout(() => onOpenChange(next), delay);
    },
    [clearTimer, onOpenChange],
  );

  const take = (count: number): void => {
    clearTimer();
    onOpenChange(false);
    onStep(count);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll("button") ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
  };

  return (
    <div
      className="md-history-slot"
      onPointerEnter={() => {
        if (!disabled) schedule(true, OPEN_DELAY_MS);
      }}
      onPointerLeave={() => schedule(false, CLOSE_DELAY_MS)}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => take(1)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !disabled) {
            event.preventDefault();
            onOpenChange(true);
            // After the menu renders, not before it exists.
            window.setTimeout(() => menu.current?.querySelector("button")?.focus(), 0);
          }
        }}
      >
        <Icon name={icon} size={13} />
      </button>

      {open ? (
        <div className="md-history-menu" ref={menu} onKeyDown={onMenuKeyDown}>
          <div className={slot("panel", "md-history-panel")} role="menu" aria-label={heading}>
            <h4>{heading}</h4>
            {/* Every step above the one under the pointer is going too, and the highlight
                says so — see the `:has(~ li:hover)` rule, which does it without a render. */}
            <ul>
              {steps.map((step) => (
                <li key={`${step.at}-${step.steps}`}>
                  <button type="button" role="menuitem" onClick={() => take(step.steps)}>
                    <span className="md-history-step">{step.label || t("history.unnamed")}</span>
                    {step.steps > 1 ? (
                      <span className="md-history-count" aria-hidden>
                        {step.steps}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="md-history-hint">
              {direction === "undo" ? t("history.undoHint") : t("history.redoHint")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
