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
export { sanitize, sanitizeInline, sanitizeBlock, stripTags } from "./sanitize.js";
export { computeWidths } from "./html/columns.js";
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
