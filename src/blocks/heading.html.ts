import type { HeadingBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr } from "../render/esc.js";
import { css, px } from "../render/style.js";
import { prepareInline } from "../render/html/inlineHtml.js";

const DEFAULT_SIZE: Record<1 | 2 | 3, number> = { 1: 30, 2: 24, 3: 19 };

/**
 * A real <h1>-<h3> for screen readers, with margin zeroed — client defaults for heading
 * margins are all different, and spacing belongs to the block's padding instead.
 */
export function renderHeading(block: HeadingBlock, ctx: RenderContext): string {
  const { settings } = ctx;
  const size = block.fontSize ?? DEFAULT_SIZE[block.level];
  const style = css({
    margin: 0,
    "font-family": block.fontFamily ?? settings.fontFamily,
    "font-size": px(size),
    "line-height": block.lineHeight ?? 1.25,
    "font-weight": "bold",
    color: block.color ?? settings.textColor,
    "text-align": block.align,
  });
  const inner = prepareInline(block.html, {
    linkColor: settings.linkColor,
    paragraphGap: 0,
  });
  return `<h${block.level} style="${escAttr(style)}">${inner}</h${block.level}>`;
}
