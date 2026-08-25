import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { Align, Spacing } from "../../types.js";
import { Icon } from "../icons.js";

/**
 * Inspector controls built on native form elements.
 *
 * `<input type="color">`, `<input type="number">` and `<select>` are keyboard accessible,
 * localised and platform-consistent for free. A component library would add a dependency to
 * reimplement all three, less well.
 */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="md-field">
      <label className="md-field-label" htmlFor={htmlFor}>
        {label}
      </label>
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
  onChange: (value: string, coalesce: boolean) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        // coalesce while typing, commit a discrete step on blur.
        onChange={(e) => onChange(e.target.value, true)}
        onBlur={(e) => onChange(e.target.value, false)}
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
  onChange: (value: string, coalesce: boolean) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        className={mono ? "md-mono" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value, true)}
        onBlur={(e) => onChange(e.target.value, false)}
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
  /** Label for the empty state when the value is optional, e.g. "Auto". */
  autoLabel,
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
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <span className="md-number">
        <input
          id={id}
          type="number"
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
  onChange,
}: {
  label: string;
  value: string | undefined;
  allowEmpty?: boolean;
  fallback?: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <span className="md-color">
        <input
          id={id}
          type="color"
          value={normaliseHex(value) ?? fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        {/* The text input accepts named colours and shorthand hex the swatch cannot show. */}
        <input
          type="text"
          className="md-mono"
          value={value ?? ""}
          placeholder={allowEmpty ? "—" : fallback}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        {allowEmpty && value ? (
          <button type="button" className="md-icon-button" onClick={() => onChange(undefined)}>
            <Icon name="close" size={11} />
          </button>
        ) : null}
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
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
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
  value,
  onChange,
}: {
  label: string;
  lockLabel: string;
  value: Spacing | undefined;
  onChange: (value: Spacing) => void;
}) {
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
    <Field label={label}>
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
