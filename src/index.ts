/**
 * @backtech/mail-designer — main entry point.
 *
 * The editor component lands here too (see MailDesigner below). Everything exported from
 * this module may touch React; anything a server needs lives in the `/render` entry, which
 * is free of React and of the DOM.
 */

/* the editor */
export { MailDesigner } from "./MailDesigner.js";
export type { MailDesignerProps } from "./MailDesigner.js";
export { TemplateMenu } from "./editor/TemplateMenu.js";
export { HistoryBar } from "./editor/HistoryBar.js";
export type { HistoryControls, CommitOptions } from "./editor/useHistory.js";
export type { HistoryEntry, HistoryState } from "./editor/history.js";
export { Icon, iconPaths } from "./editor/icons.js";
export type { IconName, IconProps } from "./editor/icons.js";
export { sv, en, createI18n, createTranslate } from "./i18n.js";
export type { Strings, StringKey, Translate } from "./i18n.js";

/* document model + tree operations */
export {
  canInsert,
  cloneBlock,
  createBlock,
  createColumn,
  createSection,
  defaultSettings,
  duplicateBlock,
  emptyDocument,
  findBlock,
  findColumn,
  insertBlock,
  listContainers,
  moveBlock,
  newId,
  removeBlock,
  sameContainer,
  setIdFactory,
  updateBlock,
  updateColumn,
  updateSettings,
  walkBlocks,
} from "./document.js";
export type { Container, Found, Position } from "./document.js";

/* rendering — re-exported so a browser consumer needs only one import */
export { toHtml } from "./render/toHtml.js";
export { toPlainText } from "./render/toPlainText.js";
export { applyMergeValues, extractMergeFields, MERGE_TOKEN } from "./render/mergeFields.js";
export { sanitize, sanitizeBlock, sanitizeInline, stripTags } from "./render/sanitize.js";
export { computeWidths } from "./render/html/columns.js";

/* loading documents that came out of someone else's database */
export { coerceDocument, validateDocument } from "./validate.js";
export type { ValidationIssue, ValidationResult } from "./validate.js";

/* template storage: contract + the adapters that need no dependencies */
export {
  assertSavable,
  createLocalStorageTemplateStore,
  createMemoryTemplateStore,
  createRestTemplateStore,
  parseTemplate,
} from "./templates.js";
export type {
  MailTemplate,
  MailTemplateSummary,
  RestTemplateStoreOptions,
  SaveTemplateInput,
  TemplateStore,
} from "./templates.js";

/* starting points */
export { builtInPresets, findPreset } from "./presets/index.js";

export type {
  Align,
  Block,
  BlockType,
  ButtonBlock,
  ColorScheme,
  ColumnsBlock,
  DesignerTheme,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  LeafBlock,
  Locale,
  MailColumn,
  MailDocument,
  MailPreset,
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
} from "./types.js";
