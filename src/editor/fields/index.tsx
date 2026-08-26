import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { Align, Spacing, VerticalAlign } from "../../types.js";
import { Icon } from "../icons.js";
import { useEditor } from "../EditorContext.js";
import { useSlot } from "../customise.js";

/**
 * Inspector controls built on native form elements.
 *
 * Each control that can be edited continuously calls `endEdit` on blur. Rapid changes to one
 * property merge into a single undo step, and leaving the field is what closes that run —
 * coming back to the same field later should be a new step, not an extension of the old one.
 *
 * `<input type="color">`, `<input type="number">` and `<select>` are keyboard accessible,
 * localised and platform-consistent for free. A component library would add a dependency to
 * reimplement all three, less well.
 */

/**
 * Marks a field that falls back to the email's own setting.
 *
 * Inheritance is the part of a two-level settings model people get lost in: without a
 * visible marker, changing a global font appears to do nothing on the blocks that happen to
 * carry their own, and there is no way to tell which those are. So every inheritable field
 * says which state it is in, and an overridden one offers a way back.
 */
export interface Inherit {
  isSet: boolean;
  onClear: () => void;
  labels: { inherited: string; overridden: string; reset: string };
}

export function Field({
  label,
  hint,
  htmlFor,
  inherit,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  inherit?: Inherit;
  children: ReactNode;
}) {
  const slot = useSlot();
  return (
    <div className={slot("field", "md-field")}>
      <div className="md-field-head">
        <label className={slot("label", "md-field-label")} htmlFor={htmlFor}>
          {label}
        </label>
        {inherit ? (
          inherit.isSet ? (
            <button
              type="button"
              className="md-inherit md-inherit--set"
              title={inherit.labels.reset}
              onClick={inherit.onClear}
            >
              {inherit.labels.overridden}
              <Icon name="close" size={9} />
            </button>
          ) : (
            <span className="md-inherit">{inherit.labels.inherited}</span>
          )
        ) : null}
      </div>
      <div className="md-field-control">{children}</div>
      {hint ? <p className="md-field-hint">{hint}</p> : null}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="md-field-row">{children}</div>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="md-inspector-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function TextField({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { endEdit } = useEditor();
  const slot = useSlot();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="text"
        className={slot("input")}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={endEdit}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  value,
  rows = 4,
  mono,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  rows?: number;
  mono?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { endEdit } = useEditor();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        className={mono ? "md-mono" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={endEdit}
      />
    </Field>
  );
}

export function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  /**
   * Shown as the placeholder when no value is set. Pass the *inherited number* rather than
   * a word like "Auto" — seeing 16 there tells the user what they will get; "Auto" does not.
   */
  autoLabel,
  inherit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  autoLabel?: string;
  inherit?: Inherit;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();
  const { endEdit } = useEditor();
  return (
    <Field label={label} hint={hint} htmlFor={id} inherit={inherit}>
      <span className="md-number">
        <input
          id={id}
          type="number"
          onBlur={endEdit}
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder={autoLabel}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
        {/* The placeholder already reads "Auto"; repeating it in the suffix said it twice. */}
        <span className="md-suffix">{value === undefined && autoLabel ? "" : suffix}</span>
      </span>
    </Field>
  );
}

export function ColorField({
  label,
  value,
  allowEmpty,
  fallback = "#000000",
  inherit,
  onChange,
}: {
  label: string;
  value: string | undefined;
  allowEmpty?: boolean;
  /** Swatch shown when nothing is set — pass the inherited colour, not black. */
  fallback?: string;
  inherit?: Inherit;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  const { endEdit } = useEditor();
  return (
    <Field label={label} htmlFor={id} inherit={inherit}>
      <span className="md-color">
        {/* A colour input fires continuously while the picker is dragged, which is exactly
            what the merge run is for; blur closes it. */}
        <input
          id={id}
          type="color"
          value={normaliseHex(value) ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          onBlur={endEdit}
        />
        {/* The text input accepts named colours and shorthand hex the swatch cannot show. */}
        <input
          type="text"
          className="md-mono"
          value={value ?? ""}
          placeholder={allowEmpty ? "—" : fallback}
          onChange={(e) => onChange(e.target.value || undefined)}
          onBlur={endEdit}
        />

      </span>
    </Field>
  );
}

/** `<input type="color">` only accepts #rrggbb, so anything else falls back to the default. */
function normaliseHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return undefined;
}

export function SelectField<T extends string | number>({
  label,
  hint,
  value,
  options,
  inherit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  inherit?: Inherit;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const slot = useSlot();
  return (
    <Field label={label} hint={hint} htmlFor={id} inherit={inherit}>
      <select
        id={id}
        className={slot("select")}
        value={String(value)}
        onChange={(e) => {
          const match = options.find((o) => String(o.value) === e.target.value);
          if (match) onChange(match.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="md-field md-field--checkbox">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
      {hint ? <p className="md-field-hint">{hint}</p> : null}
    </div>
  );
}

/**
 * Vertical alignment, in words rather than icons.
 *
 * Font Awesome's free set has no vertical-align glyphs — they are all Pro — and three short
 * words beat three improvised arrows for something this easy to misread. `value` may be
 * undefined, which is how a row whose columns disagree shows itself: nothing is pressed, and
 * choosing one sets them all.
 */
export function VerticalAlignField({
  label,
  value,
  labels,
  hint,
  onChange,
}: {
  label: string;
  value: VerticalAlign | undefined;
  labels: Record<VerticalAlign, string>;
  hint?: string;
  onChange: (value: VerticalAlign) => void;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <span className="md-segmented md-segmented--text">
        {(["top", "middle", "bottom"] as VerticalAlign[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {labels[option]}
          </button>
        ))}
      </span>
    </Field>
  );
}

export function AlignField({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: Align;
  labels: Record<Align, string>;
  onChange: (value: Align) => void;
}) {
  const icons = { left: "alignLeft", center: "alignCenter", right: "alignRight" } as const;
  return (
    <Field label={label}>
      <span className="md-segmented">
        {(["left", "center", "right"] as Align[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            title={labels[option]}
            aria-label={labels[option]}
            onClick={() => onChange(option)}
          >
            <Icon name={icons[option]} size={13} />
          </button>
        ))}
      </span>
    </Field>
  );
}

/**
 * Four numbers with a lock. Padding is the control people touch most, and typing the same
 * value four times is the friction the lock removes.
 */
export function SpacingField({
  label,
  lockLabel,
  hint,
  value,
  onChange,
  onClear,
  clearLabel,
}: {
  label: string;
  lockLabel: string;
  hint?: string;
  value: Spacing | undefined;
  onChange: (value: Spacing) => void;
  /** Present for an optional override, so it can be removed again. */
  onClear?: () => void;
  clearLabel?: string;
}) {
  const { endEdit } = useEditor();
  const current: Spacing = value ?? [0, 0, 0, 0];
  const [linked, setLinked] = useState(
    () => new Set(current).size === 1,
  );

  const set = (index: number, next: number): void => {
    if (linked) {
      onChange([next, next, next, next]);
      return;
    }
    const copy: Spacing = [...current];
    copy[index] = next;
    onChange(copy);
  };

  return (
    <Field
      label={label}
      hint={hint}
      {...(onClear && clearLabel
        ? {
            inherit: {
              isSet: true,
              onClear,
              labels: { inherited: "", overridden: label, reset: clearLabel },
            },
          }
        : {})}
    >
      <span className="md-spacing">
        {current.map((n, index) => (
          <input
            // Positional inputs with fixed meaning (top/right/bottom/left) — index is the
            // stable identity here.
            key={index}
            type="number"
            value={n}
            aria-label={["top", "right", "bottom", "left"][index]}
            onChange={(e) => set(index, Number(e.target.value || 0))}
            onBlur={endEdit}
          />
        ))}
        <button
          type="button"
          className="md-icon-button"
          aria-pressed={linked}
          title={lockLabel}
          onClick={() => {
            const next = !linked;
            setLinked(next);
            if (next) onChange([current[0], current[0], current[0], current[0]]);
          }}
        >
          <Icon name={linked ? "lock" : "unlock"} size={12} />
        </button>
      </span>
    </Field>
  );
}
