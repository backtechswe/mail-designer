import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Block, MailColumn, MailDocument, MailSettings } from "../types.js";
import type { Position } from "../document.js";
import type { Translate } from "../i18n.js";
import type { HistoryControls } from "./useHistory.js";

/**
 * Everything a panel needs, in one place.
 *
 * Mutations are exposed as verbs rather than a raw dispatch so a component never touches
 * the document tree directly: each verb applies the pure helper from document.ts and routes
 * the result through history. That is what keeps undo correct no matter which panel made
 * the change.
 */
export interface EditorApi {
  doc: MailDocument;
  selectedId: string | null;
  select: (id: string | null) => void;
  t: Translate;
  /** Tokens offered in the insert menus. Purely informational to the editor. */
  mergeFields: string[];
  onUploadImage?: ((file: File) => Promise<string>) | undefined;
  resolveSocialIcon?: ((network: string) => string) | undefined;

  /** `coalesce` merges rapid changes into one undo step — used while typing and dragging. */
  update: (id: string, patch: Partial<Block>, coalesce?: boolean) => void;
  updateSettings: (patch: Partial<MailSettings>, coalesce?: boolean) => void;
  updateColumn: (columnId: string, patch: Partial<Omit<MailColumn, "id" | "children">>) => void;
  insert: (block: Block, position: Position) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, position: Position) => void;
  replaceDocument: (next: MailDocument) => void;

  /** Arms a drag from a block's grip. Provided by the drag layer in MailDesigner. */
  startBlockDrag: (id: string, event: React.PointerEvent) => void;
  /** True while a drag is in flight, so the canvas can suppress hover chrome. */
  isDragging: boolean;

  /** Width the canvas and the preview are currently rendered at. */
  viewportWidth: number;
  /** Whether the canvas should behave the way the mobile media query will. */
  isMobileViewport: boolean;

  history: HistoryControls;
}

const EditorContext = createContext<EditorApi | null>(null);

export function EditorProvider({ api, children }: { api: EditorApi; children: ReactNode }) {
  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) {
    throw new Error("useEditor must be used inside <MailDesigner>.");
  }
  return api;
}
