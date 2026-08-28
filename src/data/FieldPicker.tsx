import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../editor/EditorContext.js";
import { rankFields } from "./trigger.js";

/**
 * The list of data fields, at the caret.
 *
 * It replaces a `<select>` whose placeholder read "[ ]" — which said nothing — and which
 * opened an OS menu that took focus away from the text being edited.
 *
 * A right-click menu was the other candidate and is worse here: nobody discovers a feature by
 * right-clicking, and inside a text field the browser's own context menu is where people go
 * for spellcheck and paste, so overriding it costs more than it gives. The caret already *is*
 * the insertion point, so the picker belongs there — opened either by the button or, more
 * usefully, by typing the `[` that starts the token anyway.
 *
 * Each row shows the field's current sample value, because "Name" alone does not tell you
 * whether it holds the recipient's name or their company's.
 */
export interface FieldPickerProps {
  /** Position within the editable's own box. */
  top: number;
  left: number;
  query: string;
  onSelect: (field: string) => void;
  onClose: () => void;
}

export function FieldPicker({ top, left, query, onSelect, onClose }: FieldPickerProps) {
  const { dataFields, data, fieldLabel, fieldSample, t } = useEditor();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const matches = useMemo(
    () => rankFields(dataFields, query, fieldLabel),
    [dataFields, query, fieldLabel],
  );

  // Reset the highlight whenever the list changes under it, so Enter never picks a row the
  // user cannot see.
  useEffect(() => setActive(0), [query, dataFields]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Keydown is captured at the document so it beats the contenteditable's own handling of
  // arrows and Enter — the caret must not move while the list is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActive((current) => {
          if (matches.length === 0) return 0;
          const next = current + (event.key === "ArrowDown" ? 1 : -1);
          return (next + matches.length) % matches.length;
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const chosen = matches[active];
        if (!chosen) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(chosen);
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [matches, active, onSelect, onClose]);

  return (
    <div className="md-fieldpicker" style={{ top, left }} role="dialog" aria-label={t("data.title")}>
      <p className="md-fieldpicker-hint">{t("data.pickerHint")}</p>
      {matches.length === 0 ? (
        <p className="md-fieldpicker-empty">
          {dataFields.length === 0 ? t("data.none") : t("data.noMatch", { query })}
        </p>
      ) : (
        <ul ref={listRef} role="listbox">
          {matches.map((field, index) => (
            <li key={field} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={index === active ? "is-active" : undefined}
                // mousedown, not click: a click would blur the contenteditable first and the
                // caret we are about to insert at would be gone.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(field);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="md-fieldpicker-name">{fieldLabel(field)}</span>
                <span className="md-fieldpicker-value">
                  {data[field]?.trim() || fieldSample(field) || t("data.noValue")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

