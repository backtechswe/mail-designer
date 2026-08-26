/**
 * The rendering entry point: `@backtech/mail-designer/render`.
 *
 * Deliberately free of React and of any DOM access, so a Node backend — a Cloud Function,
 * an ASP.NET host shelling out to node, a queue worker — can import it directly without
 * pulling the editor in.
 */
export { toHtml } from "./toHtml.js";
export { toPlainText } from "./toPlainText.js";
export { applyDataValues, extractDataFields, DATA_TOKEN } from "./dataFields.js";
/*
 * Named for what they are, not for what someone might hope they are.
 *
 * A function called `sanitize` on a package's public surface invites use as a general XSS
 * shield, and this is not one: it is a whitelist over a hand-written tokeniser, sized for the
 * subset of HTML an email client renders. The general form and `stripTags` stay internal for
 * the same reason. See SECURITY.md.
 */
export {
  sanitizeBlock as sanitizeEmailHtml,
  sanitizeInline as sanitizeInlineHtml,
} from "./sanitize.js";
export { computeWidths } from "./html/columns.js";
export { formatHtml } from "./format.js";
export { inspectEmail, emailSize, GMAIL_CLIP_BYTES } from "./inspect.js";
export { escAttr, escText, safeUrl, safeImageUrl, safeCssValue, neutraliseUrls } from "./esc.js";
export type { EmailWarning, WarningId } from "./inspect.js";
export type { DataOptions } from "./dataFields.js";
export type {
  Align,
  Block,
  BlockType,
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
  RenderOptions,
  RenderResult,
  SectionBlock,
  SectionChild,
  SocialBlock,
  SocialItem,
  SpacerBlock,
  Spacing,
  TextBlock,
  VerticalAlign,
} from "../types.js";
