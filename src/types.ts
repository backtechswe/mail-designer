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
}

interface BlockBase {
  id: string;
  padding?: Spacing;
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

export interface RenderOptions {
  /** Values substituted for [Token] placeholders after the HTML is built. */
  mergeValues?: Record<string, string>;
  /** What to do with a [Token] that has no value. Default: keep it visible. */
  onMissingMergeField?: "keep" | "blank";
  /** <html lang>. Default "sv". */
  lang?: string;
  /** <title>. Clients rarely show it, but screen readers do. */
  title?: string;
}

export interface RenderResult {
  html: string;
  text: string;
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
  bg?: string;
  bgSubtle?: string;
  border?: string;
  text?: string;
  textMuted?: string;
  danger?: string;
  radius?: number;
  space?: number;
  fontFamily?: string;
  fontFamilyMono?: string;
}

export type ColorScheme = "light" | "dark" | "system";
export type Locale = "sv" | "en";

export interface MailPreset {
  id: string;
  /** Shown in the template picker. Pass a plain string; it is not translated. */
  name: string;
  document: MailDocument;
}
