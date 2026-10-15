import type { ImageBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr, safeImageUrl, safeUrl } from "../render/esc.js";
import { IMG_DARK, IMG_LIGHT, SWAP_DARK, SWAP_LIGHT } from "../render/html/css.js";
import { css, px } from "../render/style.js";

/**
 * A fluid image capped at its intrinsic width. The width attribute is there for Outlook,
 * which ignores max-width; the CSS is there for everyone else, so the image shrinks on a
 * phone instead of forcing a horizontal scroll.
 *
 * With `lightSrc` or `darkSrc`, the variants follow the fallback as images of their own,
 * hidden inline and revealed by the rules in css.ts. They sit inside `<!--[if !mso]>` so
 * Outlook for Windows, which honours neither the media query nor always `display:none` on an
 * image, never sees them and shows only the fallback.
 */
export function renderImage(block: ImageBlock, ctx: RenderContext): string {
  const src = safeImageUrl(block.src);
  if (!src) return "";

  const lightSrc = block.lightSrc ? safeImageUrl(block.lightSrc) : "";
  // Only with a dark treatment: without it the mail stays light, and the dark variant with it.
  const darkSrc = block.darkSrc && ctx.darkImages ? safeImageUrl(block.darkSrc) : "";

  const width = Math.min(block.width ?? ctx.width, ctx.width);
  const base = {
    display: "block",
    width: "100%",
    "max-width": px(width),
    height: "auto",
    border: 0,
    "border-radius": block.borderRadius ? px(block.borderRadius) : undefined,
    // A left/right aligned image needs the margin, not just the parent's text-align.
    margin: block.align === "center" ? "0 auto" : block.align === "right" ? "0 0 0 auto" : "0",
  };
  // Hidden three ways, because clients disagree on which of them they keep.
  const hidden = { ...base, display: "none", "max-height": 0, overflow: "hidden", "mso-hide": "all" };

  const img = (url: string, style: string, className: string): string =>
    `<img src="${escAttr(url)}" alt="${escAttr(block.alt ?? "")}" ` +
    `width="${width}" border="0"${className ? ` class="${className}"` : ""} style="${escAttr(style)}" />`;

  const href = block.href ? safeUrl(block.href) : "";
  const linked = (inner: string): string =>
    href ? `<a href="${escAttr(href)}" target="_blank" style="text-decoration:none;border:0">${inner}</a>` : inner;

  const gives = [lightSrc ? SWAP_LIGHT : "", darkSrc ? SWAP_DARK : ""].filter(Boolean).join(" ");
  const fallback = linked(img(src, css(base), gives));
  if (!lightSrc && !darkSrc) return fallback;

  const variants =
    (lightSrc ? linked(img(lightSrc, css(hidden), IMG_LIGHT)) : "") +
    (darkSrc ? linked(img(darkSrc, css(hidden), IMG_DARK)) : "");
  return `${fallback}<!--[if !mso]><!-->${variants}<!--<![endif]-->`;
}
