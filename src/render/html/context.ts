import type { MailSettings } from "../../types.js";

export interface RenderContext {
  settings: MailSettings;
  /**
   * Pixels available to the block right now — the content width minus every enclosing
   * padding, and divided down inside columns. Images and VML buttons need a real number,
   * not a percentage, so we carry it down the tree.
   */
  width: number;
}
