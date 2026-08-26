import { useEffect, useRef } from "react";
import { useEditor } from "./EditorContext.js";
import { useSlot } from "./customise.js";

export interface ConfirmRequest {
  title: string;
  body?: string;
  /** Label for the confirming action. Says what will happen, never "OK". */
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * An in-page confirm.
 *
 * Not `window.confirm`: it blocks the whole page, cannot be styled or translated, and in an
 * embedded editor it looks like the host application is broken. This one is focus-trapped,
 * closes on Escape, and puts initial focus on the confirming button so Enter completes the
 * action the user already decided on.
 *
 * The copy carries the weight. A prompt that only asks "are you sure?" makes the user guess
 * at the consequence, so each one states what will happen and — where it is true — that it
 * can be undone.
 */
export function ConfirmDialog({
  request,
  onCancel,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
}) {
  const { t } = useEditor();
  const slot = useSlot();
  const panel = useRef<HTMLDivElement | null>(null);
  const confirm = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!request) return;
    confirm.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep focus inside: a dialog you can tab out of is a dialog people answer by
      // accident, having lost track of what has focus.
      const focusable = panel.current?.querySelectorAll<HTMLElement>("button, [href], input");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [request, onCancel]);

  if (!request) return null;

  return (
    <div className="md-dialog-scrim" onClick={onCancel}>
      <div
        className={slot("panel", "md-dialog")}
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{request.title}</h3>
        {request.body ? <p>{request.body}</p> : null}
        <div className="md-dialog-actions">
          <button type="button" onClick={onCancel}>
            {t("confirm.cancel")}
          </button>
          <button
            type="button"
            ref={confirm}
            className={request.destructive ? "md-dialog-danger" : "md-dialog-primary"}
            onClick={() => {
              request.onConfirm();
              onCancel();
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
