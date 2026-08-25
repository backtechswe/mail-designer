import type { Block, BlockLock, BlockType, MailDocument } from "./types.js";
import { extractDataFields } from "./render/dataFields.js";
import { walkBlocks } from "./document.js";

/**
 * What the user is allowed to do.
 *
 * Deliberately few knobs, each one something a product decision actually sounds like —
 * "they can rearrange it but not rewrite the words" — rather than a switch per control. A
 * config with forty flags is one nobody configures correctly.
 *
 * Everything defaults to permitted, so a host that passes nothing gets the full editor.
 */
export interface Permissions {
  /** Add, remove, duplicate and move blocks. */
  structure?: boolean;
  /** Edit the words and pictures: text, headings, image sources, links, button labels. */
  content?: boolean;
  /** Colours, fonts, sizes, spacing, alignment — the look of a block. */
  appearance?: boolean;
  /** The email-wide settings tab. */
  mailSettings?: boolean;
  /**
   * "edit" lets the user change the sample data, "readonly" shows it without letting them,
   * "hidden" removes the panel. Use "readonly" when the application supplies the data.
   */
  data?: "edit" | "readonly" | "hidden";
  /** Which block types the palette offers. Omit for all of them. */
  blocks?: BlockType[];
  /**
   * Fields that must appear somewhere in the email. The editor warns when one does not — a
   * confirmation mail that has quietly lost [Datum] is worse than one that looks wrong.
   */
  requiredFields?: string[];
  /** Whether the user may create and delete documents. The store decides *which* exist. */
  manageDocuments?: boolean;
  /** Undo/redo controls. */
  history?: boolean;
  /** The template picker. */
  templates?: boolean;
}

export type ResolvedPermissions = Required<Omit<Permissions, "blocks" | "requiredFields">> & {
  blocks: BlockType[] | null;
  requiredFields: string[];
};

export function resolvePermissions(permissions: Permissions = {}): ResolvedPermissions {
  return {
    structure: permissions.structure ?? true,
    content: permissions.content ?? true,
    appearance: permissions.appearance ?? true,
    mailSettings: permissions.mailSettings ?? true,
    data: permissions.data ?? "edit",
    blocks: permissions.blocks ?? null,
    requiredFields: permissions.requiredFields ?? [],
    manageDocuments: permissions.manageDocuments ?? true,
    history: permissions.history ?? true,
    templates: permissions.templates ?? true,
  };
}

export function allowsBlockType(permissions: ResolvedPermissions, type: BlockType): boolean {
  return permissions.blocks === null || permissions.blocks.includes(type);
}

export interface BlockCapabilities {
  editContent: boolean;
  editAppearance: boolean;
  move: boolean;
  remove: boolean;
  /** True when the block itself carries a lock, so the UI can say why. */
  locked: boolean;
}

function lockDenies(lock: BlockLock | undefined, aspect: keyof Exclude<BlockLock, boolean>): boolean {
  if (lock === undefined || lock === false) return false;
  if (lock === true) return true;
  return lock[aspect] === true;
}

/**
 * What may be done to one specific block: the global permission, minus whatever the block
 * locks for itself. A lock can only take away — a locked block in a fully editable document
 * is still locked, and an unlocked block in a read-only document is still read-only.
 */
export function blockCapabilities(
  block: Block,
  permissions: ResolvedPermissions,
): BlockCapabilities {
  const lock = block.locked;
  return {
    editContent: permissions.content && !lockDenies(lock, "content"),
    editAppearance: permissions.appearance && !lockDenies(lock, "appearance"),
    move: permissions.structure && !lockDenies(lock, "move"),
    remove: permissions.structure && !lockDenies(lock, "remove"),
    locked: lock === true || (typeof lock === "object" && Object.values(lock).some(Boolean)),
  };
}

/* ------------------------------------------------------------- data coverage */

export interface DataCoverage {
  /** Fields present in the data and shown somewhere in the email. */
  used: string[];
  /** Fields present in the data but not shown anywhere — information silently dropped. */
  unused: string[];
  /** Tokens the email uses that the data has no value for. */
  withoutValue: string[];
  /** Required fields the email does not show. The one that should block a send. */
  missingRequired: string[];
}

/**
 * Does the email actually show everything it was given?
 *
 * The check that matters for transactional mail. If the application supplies `Datum` and the
 * user has deleted the block containing `[Datum]`, nothing breaks and nothing complains — the
 * recipient just gets a confirmation with the date missing. Comparing the two sets is the
 * only way anyone finds out before it is sent.
 *
 * Matching is case-insensitive, the same way substitution is.
 */
export function dataCoverage(
  doc: MailDocument,
  data: Record<string, string>,
  requiredFields: readonly string[] = [],
): DataCoverage {
  const tokens = new Set(extractDataFields(doc).map((f) => f.toLowerCase()));
  const keys = Object.keys(data);

  const used = keys.filter((key) => tokens.has(key.toLowerCase()));
  const unused = keys.filter((key) => !tokens.has(key.toLowerCase()));

  const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));
  const withoutValue = extractDataFields(doc).filter((f) => !lowerKeys.has(f.toLowerCase()));

  const missingRequired = requiredFields.filter((f) => !tokens.has(f.toLowerCase()));

  return { used, unused, withoutValue, missingRequired };
}

/** Every block id in the document that carries a lock, for a host auditing a template. */
export function lockedBlockIds(doc: MailDocument): string[] {
  const ids: string[] = [];
  walkBlocks(doc, (block) => {
    if (blockCapabilities(block, resolvePermissions()).locked) ids.push(block.id);
  });
  return ids;
}
