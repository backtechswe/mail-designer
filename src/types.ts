/**
 * The document model. This is the contract: it is plain JSON, it is versioned, and it is
 * what a host app persists. Everything else in the package is derived from it.
 */

export type Align = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

/** [top, right, bottom, left] in px — the order CSS uses. */
export type Spacing = [number, number, number, number];

export interface MailSettings {
  /** Content width in px. 600 is the safe default for every client. */
  width: number;
  /** Page background, outside the content column. */
  backgroundColor: string;
  /** The content column's own background. */
  contentBackgroundColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  /**
   * Hidden preview text shown after the subject line in the inbox. Without it clients
   * show the first words of the body, which is rarely what you want.
   */
  preheader?: string;
  /**
   * What the mail should look like when the reader is in dark mode.
   *
   * Omit it and clients decide for you, which they will do badly. Apple Mail and Outlook.com
   * invert colours on their own: dark text on white becomes light text on dark, and a PNG logo
   * with a white background does *not* invert — it stays a glowing white rectangle in the
   * middle of a dark message. That is the most common dark-mode bug in email, and giving the
   * client the four colours it needs is what prevents it.
   *
   * Anything left out keeps its light value.
   */
  dark?: DarkSettings;
}

/**
 * The four colours dark mode actually turns on. Deliberately not a second copy of every
 * setting: type, spacing and width do not change with the light, and a per-block dark colour
 * is a promise no email client can keep consistently.
 */
export interface DarkSettings {
  backgroundColor?: string;
  contentBackgroundColor?: string;
  textColor?: string;
  linkColor?: string;
}

/**
 * Locks that travel with the block, in the document itself.
 *
 * That placement is the point: a host can ship a template where the legal footer and the
 * `[Date]` line are fixed while everything around them is the user's to arrange. Permissions
 * passed as a prop cannot express "this block, not that one".
 *
 * `true` locks everything. An object locks individual aspects.
 */
export type BlockLock =
  | boolean
  | {
      /** The words and pictures. */
      content?: boolean;
      /** Colours, fonts, spacing, alignment. */
      appearance?: boolean;
      move?: boolean;
      remove?: boolean;
    };

interface BlockBase {
  id: string;
  padding?: Spacing;
  /**
   * Padding used on narrow screens instead of `padding`.
   *
   * A progressive enhancement, and it has to be treated as one: it is delivered by the media
   * query in <style>, which Outlook desktop ignores by design (it is always a wide viewport)
   * but which a handful of clients strip from <head> altogether. Where that happens the
   * desktop padding is used, so that value must be the one that is merely tight rather than
   * broken.
   */
  mobilePadding?: Spacing;
  locked?: BlockLock;
  /**
   * Drop this block when the data has nothing to put in it.
   *
   * A transactional template almost always has a field that is sometimes absent, and
   * without this the only way to express it is to move the label inside the value — a
   * `[Note]` that the host sets to either `""` or `"Note: …"`. That leaves the block itself
   * behind whatever happens, so an empty value still renders empty padding, and the label
   * is no longer editable in the editor.
   *
   * "Empty" means the fields this block refers to, not the text it renders. A block reading
   * `Note: [Note]` renders as `Note: ` when the value is missing, which is not blank — and
   * the leftover label is exactly what this exists to remove. So: a block is dropped when it
   * refers to at least one field and none of them have a value. A block that refers to no
   * fields is never dropped, having nothing to be conditional on.
   *
   * Requires rendering per recipient — `toHtml(doc, { data })`. Rendering once and
   * substituting downstream in an ESP cannot work, because by then the block is already in
   * the HTML. Worse, it fails in the direction that loses content: with no `data` the block
   * matches nothing, is dropped, and is dropped from the *stored* HTML — for every recipient,
   * including the ones whose values would have filled it. Rendering without `data` therefore
   * puts a `conditional-without-data` warning in `RenderResult.warnings` naming the blocks
   * that went, rather than letting the mail go out short and silent.
   */
  hideWhenEmpty?: boolean;
}

/**
 * Nesting is deliberately shallow: document -> section -> (columns -> leaf | leaf).
 * Columns cannot nest. Email HTML gets unreliable fast beyond one level, and no real
 * newsletter needs more.
 */
export interface SectionBlock extends BlockBase {
  type: "section";
  backgroundColor?: string;
  backgroundUrl?: string;
  /** Stretch the background edge to edge while keeping content at settings.width. */
  fullWidth?: boolean;
  children: SectionChild[];
}

export interface MailColumn {
  id: string;
  /** Percent of the row. Omitted columns share the remainder equally. */
  width?: number;
  verticalAlign?: VerticalAlign;
  backgroundColor?: string;
  padding?: Spacing;
  children: LeafBlock[];
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  /** Horizontal space between columns in px, applied as cell padding. */
  gap: number;
  stackOnMobile: boolean;
  columns: MailColumn[];
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 1 | 2 | 3;
  /** Inline HTML only: b, i, em, strong, a, br, span. */
  html: string;
  align: Align;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}

export interface TextBlock extends BlockBase {
  type: "text";
  html: string;
  align: Align;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  href?: string;
  /** Intrinsic width in px. Omitted means full column width. */
  width?: number;
  align: Align;
  borderRadius?: number;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  href: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
  fontFamily?: string;
  /** Inner padding of the button itself, distinct from the block's outer padding. */
  innerPadding: Spacing;
  /**
   * Explicit width in px. Only with a known width can we emit the VML fallback that
   * gives Outlook desktop rounded corners — without it Outlook renders a square
   * button, which is a cosmetic difference rather than a break.
   */
  width?: number;
  fullWidth?: boolean;
  align: Align;
}

export interface SocialItem {
  network: string;
  href: string;
  /**
   * Absolute URL. Gmail blocks data: URIs in <img>, so icons cannot be inlined —
   * see resolveSocialIcon on MailDesignerProps.
   */
  iconUrl: string;
  label?: string;
}

export interface SocialBlock extends BlockBase {
  type: "social";
  items: SocialItem[];
  iconSize: number;
  spacing: number;
  align: Align;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  color: string;
  thickness: number;
  /** Percent of the container width. */
  width: number;
  align: Align;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export interface HtmlBlock extends BlockBase {
  type: "html";
  html: string;
}

export type LeafBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | SocialBlock
  | DividerBlock
  | SpacerBlock
  | HtmlBlock;

export type SectionChild = ColumnsBlock | LeafBlock;
export type Block = SectionBlock | SectionChild;
export type BlockType = Block["type"];

export interface MailDocument {
  version: 1;
  settings: MailSettings;
  blocks: SectionBlock[];
}

/* ------------------------------------------------------------------ rendering */

/**
 * A data field, described rather than merely named.
 *
 * `data` alone conflates two things that are not the same: what the field is called in the
 * document, and what a person should be shown. They have to differ the moment an editor is
 * multilingual — the token has to stay `[FirstName]` when the interface switches to Swedish,
 * because the token is stored in the document and the document outlives the session.
 *
 * `data` still holds the values. This describes them.
 */
export interface DataField {
  /** The token: `[name]` in the document. Stable, and never translated. */
  name: string;
  /** What the editor shows instead of `name`. Defaults to `name`. */
  label?: string;
  /** A preview value, used where `data` has none. Not written back into `data`. */
  sample?: string;
}

export interface RenderOptions {
  /** Values substituted for [Token] placeholders after the HTML is built. */
  data?: Record<string, string>;
  /** What to do with a [Token] that has no value. Default: keep it visible. */
  onMissingField?: "keep" | "blank";
  /**
   * Fields whose values are markup, sanitised rather than escaped. See DataOptions.raw —
   * the allowlist still applies, so this grants formatting, not trust.
   */
  rawFields?: readonly string[];
  /** <html lang>. Default "sv". */
  lang?: string;
  /** <title>. Clients rarely show it, but screen readers do. */
  title?: string;
}

export interface RenderResult {
  html: string;
  text: string;
  /**
   * What went wrong while rendering, as opposed to what is wrong with the result —
   * `inspectEmail` covers the second and folds these in. Always set by `toHtml`; optional
   * only so a hand-built result still satisfies the type.
   */
  warnings?: EmailWarning[];
}

/* ---------------------------------------------------------------- warnings */

export type WarningId =
  | "gmail-clipping"
  | "data-uri-image"
  | "background-image"
  | "no-preheader"
  | "missing-alt"
  | "wide-content"
  | "no-plain-text"
  | "no-dark-mode"
  | "conditional-without-data";

export interface EmailWarning {
  id: WarningId;
  /** "error" is something a recipient will certainly notice; "warning" is a risk. */
  level: "error" | "warning";
  /** Block ids the warning is about, where it is about specific blocks. */
  blocks?: string[];
  /** Numbers worth showing, e.g. the byte count. */
  detail?: Record<string, number | string>;
}

/* ------------------------------------------------------------------- editor */

/**
 * The editor's own chrome. Distinct from MailSettings, which is what the *recipient*
 * sees. Every value maps to a CSS custom property, so a host app can restyle the
 * editor without touching a single class name.
 */
export interface DesignerTheme {
  accent?: string;
  accentContrast?: string;
  /** Tinted accent used for selected and hovered states. */
  accentSoft?: string;
  /** Panel surfaces. */
  bg?: string;
  /** Secondary surfaces: hovered rows, the add-section bar. */
  bgSubtle?: string;
  /** The canvas well the email floats in. */
  bgSunken?: string;
  border?: string;
  /** Hairlines that need to read as an edge rather than a whisper. */
  borderStrong?: string;
  text?: string;
  textMuted?: string;
  danger?: string;
  radius?: number;
  space?: number;
  fontFamily?: string;
  fontFamilyMono?: string;
  /** Shadow on the email itself — the one elevated object in the editor. */
  lift?: string;
}

export type ColorScheme = "light" | "dark" | "system";
/**
 * A BCP 47 tag. Open on purpose: only English ships in the main bundle, so a closed union
 * would exclude every language the package can be given through `strings` — see
 * `@backtech/mail-designer/locales/*`. The two spelled out are the ones that need no import.
 */
export type Locale = "en" | "sv" | (string & {});

export interface MailPreset {
  id: string;
  /** Shown in the template picker. Pass a plain string; it is not translated. */
  name: string;
  document: MailDocument;
}
