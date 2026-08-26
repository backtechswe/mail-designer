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
export { ConfirmDialog } from "./editor/ConfirmDialog.js";
export type { ConfirmRequest } from "./editor/ConfirmDialog.js";
export { ShortcutsPanel, MOD } from "./editor/ShortcutsPanel.js";
export { DocumentBar } from "./session/DocumentBar.js";
export { DataPanel } from "./data/DataPanel.js";
export {
  allowsBlockType,
  blockCapabilities,
  dataCoverage,
  lockedBlockIds,
  resolvePermissions,
} from "./permissions.js";
export type {
  BlockCapabilities,
  DataCoverage,
  Permissions,
  ResolvedPermissions,
} from "./permissions.js";
export { useDocumentSession } from "./session/useDocumentSession.js";
export type { DocumentSession, DocumentSessionOptions } from "./session/useDocumentSession.js";
export { hasUnsavedWork, statusReducer, initialStatus, generateName } from "./session/status.js";
export type { SessionStatus, SessionEvent, SaveState } from "./session/status.js";
export type { HistoryControls, CommitOptions } from "./editor/useHistory.js";
export type { HistoryEntry, HistoryState } from "./editor/history.js";
/*
 * `Icon` and `IconName`, not `iconPaths`. Exporting the paths would make the exact SVG geometry
 * of sixty-two icons a stable public contract that a regeneration against a new Font Awesome
 * release would break — and it is CC BY-encumbered data. `customise.icons` is the supported
 * way to change a glyph.
 */
export { Icon } from "./editor/icons.js";
export { compressImage, formatBytes } from "./editor/compress.js";
export type {
  EditorClassNames,
  EditorCustomisation,
  EditorSlot,
} from "./editor/customise.js";
export type { CompressOptions, CompressResult } from "./editor/compress.js";
export type { IconName, IconProps } from "./editor/icons.js";
export { sv, en, createI18n, createTranslate } from "./i18n.js";
export type { Strings, StringKey, Translate } from "./i18n.js";

/* document model + tree operations */
export {
  ancestorsOf,
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
  parentOf,
  removeBlock,
  sameContainer,
  updateBlock,
  updateColumn,
  updateSettings,
  walkBlocks,
} from "./document.js";
export type { Container, Found, Position } from "./document.js";

/* rendering — re-exported so a browser consumer needs only one import */
export { toHtml } from "./render/toHtml.js";
export { toPlainText } from "./render/toPlainText.js";
export { applyDataValues, extractDataFields, DATA_TOKEN } from "./render/dataFields.js";
export { sanitize, sanitizeBlock, sanitizeInline, stripTags } from "./render/sanitize.js";
export { computeWidths } from "./render/html/columns.js";
export { inspectEmail, emailSize, GMAIL_CLIP_BYTES } from "./render/inspect.js";
export type { EmailWarning, WarningId } from "./render/inspect.js";

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
  BlockLock,
} from "./types.js";
