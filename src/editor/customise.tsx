import { createContext, useContext } from "react";
import type { ComponentType, ReactNode } from "react";
import type { IconName } from "./icons.js";

/**
 * Two ways to make the editor look like the host application, and deliberately only two.
 *
 * `classNames` attaches the host's own classes to a small set of named parts. Ours stay, and
 * theirs are appended, so a Tailwind class beats the corresponding rule in styles.css without
 * anyone reaching for `!important` — the base rules are wrapped in `:where()` for exactly this
 * reason. `icons` swaps a glyph for the host's own.
 *
 * What is *not* here is a slot for every element, or a way to replace whole panels. Both would
 * turn this file's internals into a public contract, and a class map plus an icon map covers
 * what a design system actually needs: its colours, its type, its spacing, its glyphs.
 */
export interface EditorClassNames {
  /** The editor's outermost element. */
  root?: string;
  /** The toolbar strip above the panels. */
  toolbar?: string;
  /** The document bar, when a store is given. */
  documentBar?: string;
  /** The block palette on the left. */
  palette?: string;
  /** The scrolling canvas in the middle. */
  canvas?: string;
  /** The inspector column on the right. */
  inspector?: string;
  /** Any raised surface: a dropdown panel, the history menu, a dialog. */
  panel?: string;
  /** Every button the editor renders, unless a more specific slot applies. */
  button?: string;
  /** A button in its chosen or active state. */
  buttonActive?: string;
  /** Text inputs, number inputs and textareas. */
  input?: string;
  /** Select elements. */
  select?: string;
  /** A field's wrapper — label plus control. */
  field?: string;
  /** A field's label text. */
  label?: string;
}

export type EditorSlot = keyof EditorClassNames;

export interface EditorCustomisation {
  classNames?: EditorClassNames;
  /** Replaces individual glyphs. Anything omitted keeps the built-in icon. */
  icons?: Partial<Record<IconName, ComponentType<{ size?: number; className?: string }>>>;
}

const CustomisationContext = createContext<EditorCustomisation>({});

export function CustomisationProvider({
  value,
  children,
}: {
  value: EditorCustomisation;
  children: ReactNode;
}) {
  return <CustomisationContext.Provider value={value}>{children}</CustomisationContext.Provider>;
}

export function useCustomisation(): EditorCustomisation {
  return useContext(CustomisationContext);
}

/**
 * Our class names plus the host's for these slots.
 *
 * Ours first so theirs wins on equal specificity, which is the whole contract: a host adds a
 * class and it takes effect, without having to know what our rule looked like.
 */
export function useSlot(): (slots: EditorSlot | EditorSlot[], ...own: (string | false | undefined)[]) => string {
  const { classNames } = useCustomisation();
  return (slots, ...own) => {
    const wanted = Array.isArray(slots) ? slots : [slots];
    const extra = wanted.map((slot) => classNames?.[slot]).filter(Boolean);
    return [...own.filter(Boolean), ...extra].join(" ");
  };
}
