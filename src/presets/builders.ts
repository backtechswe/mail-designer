import type {
  Align,
  ButtonBlock,
  ColumnsBlock,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  LeafBlock,
  MailColumn,
  MailDocument,
  MailSettings,
  SectionBlock,
  SectionChild,
  SocialBlock,
  SpacerBlock,
  Spacing,
  TextBlock,
} from "../types.js";
import { defaultSettings } from "../document.js";

/**
 * Block constructors for the built-in presets.
 *
 * Presets are TypeScript rather than JSON so `tsc` remains the entire build — no asset
 * copying — and so every preset is type-checked against the document model. Ids are literal
 * and deterministic; the editor clones a preset with fresh ids when it is applied, so
 * applying the same one twice never produces colliding ids.
 */

let seq = 0;


/** Reset between preset modules so ids stay short and stable. */
export function resetIds(prefix: string): void {
  seq = 0;
  idPrefix = prefix;
}
let idPrefix = "p";
const id = (): string => `${idPrefix}${++seq}`;

export const heading = (html: string, patch: Partial<HeadingBlock> = {}): HeadingBlock => ({
  id: id(),
  type: "heading",
  level: 2,
  html,
  align: "left",
  padding: [0, 0, 12, 0],
  ...patch,
});

export const text = (html: string, patch: Partial<TextBlock> = {}): TextBlock => ({
  id: id(),
  type: "text",
  html,
  align: "left",
  padding: [0, 0, 12, 0],
  ...patch,
});

/**
 * Small-caps label. Email has no reliable `font-variant`, so this is literal capitals plus
 * letter-spacing — the one place where typing it out beats a CSS property.
 */
export const eyebrow = (
  label: string,
  color: string,
  patch: Partial<TextBlock> = {},
): TextBlock =>
  text(`<span style="letter-spacing:0.14em;font-weight:bold">${label.toUpperCase()}</span>`, {
    fontSize: 12,
    color,
    padding: [0, 0, 8, 0],
    ...patch,
  });

export const image = (
  src: string,
  alt: string,
  patch: Partial<ImageBlock> = {},
): ImageBlock => ({
  id: id(),
  type: "image",
  src,
  alt,
  align: "center",
  padding: [0, 0, 0, 0],
  ...patch,
});

export const button = (
  label: string,
  patch: Partial<ButtonBlock> = {},
): ButtonBlock => ({
  id: id(),
  type: "button",
  label,
  href: "https://",
  backgroundColor: "#2f54eb",
  textColor: "#ffffff",
  borderRadius: 6,
  fontSize: 16,
  innerPadding: [14, 28, 14, 28],
  align: "left",
  padding: [4, 0, 0, 0],
  ...patch,
});

export const divider = (patch: Partial<DividerBlock> = {}): DividerBlock => ({
  id: id(),
  type: "divider",
  color: "#e2e6ea",
  thickness: 1,
  width: 100,
  align: "center",
  padding: [8, 0, 24, 0],
  ...patch,
});

export const spacer = (height = 24): SpacerBlock => ({ id: id(), type: "spacer", height });

export const html = (markup: string): HtmlBlock => ({ id: id(), type: "html", html: markup });

export const social = (patch: Partial<SocialBlock> = {}): SocialBlock => ({
  id: id(),
  type: "social",
  items: [],
  iconSize: 20,
  spacing: 12,
  align: "center",
  padding: [0, 0, 12, 0],
  ...patch,
});

export const column = (children: LeafBlock[], width?: number): MailColumn => ({
  id: id(),
  children,
  ...(width === undefined ? {} : { width }),
});

export const columns = (
  cols: MailColumn[],
  patch: Partial<ColumnsBlock> = {},
): ColumnsBlock => ({
  id: id(),
  type: "columns",
  gap: 24,
  stackOnMobile: true,
  columns: cols,
  ...patch,
});

export const section = (
  children: SectionChild[],
  patch: Partial<SectionBlock> = {},
): SectionBlock => ({
  id: id(),
  type: "section",
  padding: [40, 40, 40, 40] as Spacing,
  children,
  ...patch,
});

export const doc = (
  blocks: SectionBlock[],
  settings: Partial<MailSettings> = {},
): MailDocument => ({
  version: 1,
  settings: { ...defaultSettings, ...settings },
  blocks,
});

/**
 * A masthead row: wordmark on the left, a short piece of context on the right. Two columns
 * rather than one centred line, because the pair reads as a header rather than a title.
 */
export function masthead(
  wordmark: string,
  meta: string,
  colors: { ink: string; muted: string },
  patch: Partial<SectionBlock> = {},
): SectionBlock {
  return section(
    [
      columns(
        [
          column([
            text(
              `<span style="letter-spacing:0.16em;font-weight:bold">${wordmark.toUpperCase()}</span>`,
              { fontSize: 13, color: colors.ink, padding: [0, 0, 0, 0] },
            ),
          ]),
          column([
            text(meta, {
              fontSize: 12,
              color: colors.muted,
              align: "right",
              padding: [1, 0, 0, 0],
            }),
          ]),
        ],
        // Two halves of one line: stacking them on a phone would read as two paragraphs.
        { gap: 12, stackOnMobile: false },
      ),
    ],
    { padding: [28, 40, 28, 40], ...patch },
  );
}

/** The legal tail every real mailing needs, in the template's own palette. */
export function footer(
  colors: { muted: string; rule: string },
  lines: string[],
  align: Align = "center",
): SectionBlock {
  return section(
    [
      divider({ color: colors.rule, padding: [0, 0, 20, 0] }),
      ...lines.map((line) =>
        text(line, {
          fontSize: 12,
          lineHeight: 1.6,
          color: colors.muted,
          align,
          padding: [0, 0, 6, 0],
        }),
      ),
    ],
    { padding: [8, 40, 32, 40] },
  );
}
