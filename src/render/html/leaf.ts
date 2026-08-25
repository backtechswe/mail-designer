import type { LeafBlock } from "../../types.js";
import type { RenderContext } from "./context.js";
import { renderHeading } from "../../blocks/heading.html.js";
import { renderText } from "../../blocks/text.html.js";
import { renderImage } from "../../blocks/image.html.js";
import { renderButton } from "../../blocks/button.html.js";
import { renderSocial } from "../../blocks/social.html.js";
import { renderDivider } from "../../blocks/divider.html.js";
import { renderSpacer } from "../../blocks/spacer.html.js";
import { renderRawHtml } from "../../blocks/html.html.js";

/** Dispatch to the per-block emitters. Returns "" for a block with nothing to show. */
export function renderLeaf(block: LeafBlock, ctx: RenderContext): string {
  switch (block.type) {
    case "heading":
      return renderHeading(block, ctx);
    case "text":
      return renderText(block, ctx);
    case "image":
      return renderImage(block, ctx);
    case "button":
      return renderButton(block, ctx);
    case "social":
      return renderSocial(block);
    case "divider":
      return renderDivider(block);
    case "spacer":
      return renderSpacer(block);
    case "html":
      return renderRawHtml(block);
  }
}
