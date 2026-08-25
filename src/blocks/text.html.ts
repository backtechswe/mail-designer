import type { TextBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr } from "../render/esc.js";
import { css, px } from "../render/style.js";
import { prepareInline } from "../render/html/inlineHtml.js";
import { align, num } from "../render/values.js";

export function renderText(block: TextBlock, ctx: RenderContext): string {
  const { settings } = ctx;
  // Coerced, not trusted: a block-level override is whatever the stored document says.
  const size = num(block.fontSize ?? settings.fontSize, 16, 1, 400);
  const lineHeight = num(block.lineHeight ?? settings.lineHeight, 1.5, 0.5, 10);
  const style = css({
    "font-family": block.fontFamily ?? settings.fontFamily,
    "font-size": px(size),
    // Outlook's Word engine ignores a unitless line-height and substitutes its own; px plus
    // mso-line-height-rule is what makes it obey. Everything else treats them the same.
    "line-height": px(Math.round(size * lineHeight)),
    "mso-line-height-rule": "exactly",
    color: block.color ?? settings.textColor,
    "text-align": align(block.align),
    // A pasted URL with no spaces in it will otherwise widen the table past the mail's own
    // width in Outlook, pushing everything out of alignment.
    "word-break": "break-word",
  });
  const inner = prepareInline(block.html, {
    linkColor: settings.linkColor,
    // Paragraph spacing tracks the type size, so bigger text breathes proportionally.
    paragraphGap: Math.round(size * 0.75),
  });
  return `<div style="${escAttr(style)}">${inner}</div>`;
}
