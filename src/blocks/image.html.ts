import type { ImageBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr, safeImageUrl, safeUrl } from "../render/esc.js";
import { css, px } from "../render/style.js";

/**
 * A fluid image capped at its intrinsic width. The width attribute is there for Outlook,
 * which ignores max-width; the CSS is there for everyone else, so the image shrinks on a
 * phone instead of forcing a horizontal scroll.
 */
export function renderImage(block: ImageBlock, ctx: RenderContext): string {
  const src = safeImageUrl(block.src);
  if (!src) return "";

  const width = Math.min(block.width ?? ctx.width, ctx.width);
  const style = css({
    display: "block",
    width: "100%",
    "max-width": px(width),
    height: "auto",
    border: 0,
    "border-radius": block.borderRadius ? px(block.borderRadius) : undefined,
    // A left/right aligned image needs the margin, not just the parent's text-align.
    margin: block.align === "center" ? "0 auto" : block.align === "right" ? "0 0 0 auto" : "0",
  });

  const img =
    `<img src="${escAttr(src)}" alt="${escAttr(block.alt ?? "")}" ` +
    `width="${width}" border="0" style="${escAttr(style)}" />`;

  const href = block.href ? safeUrl(block.href) : "";
  if (!href) return img;
  return `<a href="${escAttr(href)}" target="_blank" style="text-decoration:none;border:0">${img}</a>`;
}
