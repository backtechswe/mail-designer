import type { TextBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr } from "../render/esc.js";
import { css, px } from "../render/style.js";
import { prepareInline } from "../render/html/inlineHtml.js";

export function renderText(block: TextBlock, ctx: RenderContext): string {
  const { settings } = ctx;
  const size = block.fontSize ?? settings.fontSize;
  const lineHeight = block.lineHeight ?? settings.lineHeight;
  const style = css({
    "font-family": block.fontFamily ?? settings.fontFamily,
    "font-size": px(size),
    "line-height": lineHeight,
    color: block.color ?? settings.textColor,
    "text-align": block.align,
  });
  const inner = prepareInline(block.html, {
    linkColor: settings.linkColor,
    // Paragraph spacing tracks the type size, so bigger text breathes proportionally.
    paragraphGap: Math.round(size * 0.75),
  });
  return `<div style="${escAttr(style)}">${inner}</div>`;
}
