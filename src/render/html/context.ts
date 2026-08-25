import type { MailSettings, Spacing } from "../../types.js";

export interface RenderContext {
  settings: MailSettings;
  /**
   * Class for a block's mobile padding, or "" when it has none. Built once per render from
   * every distinct value in the document, so identical paddings share one CSS rule.
   */
  mobileClass: (padding: Spacing | undefined) => string;
  /**
   * Pixels available to the block right now — the content width minus every enclosing
   * padding, and divided down inside columns. Images and VML buttons need a real number,
   * not a percentage, so we carry it down the tree.
   */
  width: number;
}
