import type { ButtonBlock } from "../types.js";
import type { RenderContext } from "../render/html/context.js";
import { escAttr, escText, safeUrl } from "../render/esc.js";
import { TABLE_RESET, css, px, spacing } from "../render/style.js";
import { align, num } from "../render/values.js";

/**
 * A bulletproof button: a table cell carrying the background and radius, with an <a>
 * filling it. mso-padding-alt hands Outlook the padding it refuses to take from the <a>.
 *
 * Rounded corners are the one thing Outlook desktop cannot do with CSS — it needs VML.
 * VML needs literal pixel dimensions, which we only have when the author sets an explicit
 * width, so that is exactly when we emit it. Without a width the button is square in
 * Outlook and rounded everywhere else: a cosmetic difference, not a broken layout, and far
 * better than guessing a size and shipping a clipped button.
 */
export function renderButton(block: ButtonBlock, ctx: RenderContext): string {
  const href = safeUrl(block.href);
  const label = escText(block.label ?? "");
  const fontFamily = block.fontFamily ?? ctx.settings.fontFamily;

  // Same factor the VML height below uses, so Outlook's box matches everyone else's button.
  const lineHeight = Math.round(block.fontSize * 1.2);

  const linkStyle = css({
    display: "inline-block",
    "font-family": fontFamily,
    "font-size": px(block.fontSize),
    // px, not a ratio: Outlook ignores unitless line-height, which would change the button's
    // height and leave the label off-centre.
    "line-height": px(lineHeight),
    "mso-line-height-rule": "exactly",
    "font-weight": "bold",
    color: block.textColor,
    "text-decoration": "none",
    padding: spacing(block.innerPadding),
    "mso-padding-alt": "0",
    "border-radius": px(block.borderRadius),
    width: block.width ? px(block.width) : block.fullWidth ? "100%" : undefined,
    "text-align": "center",
    "box-sizing": "border-box",
  });

  const cellStyle = css({
    "background-color": block.backgroundColor,
    "border-radius": px(block.borderRadius),
    "mso-padding-alt": "0",
  });

  const table =
    `<table${TABLE_RESET} align="${align(block.align)}"` +
    (block.fullWidth ? ' width="100%"' : "") +
    `><tr><td align="center" bgcolor="${escAttr(block.backgroundColor)}" ` +
    `style="${escAttr(cellStyle)}">` +
    `<a href="${escAttr(href)}" target="_blank" style="${escAttr(linkStyle)}">${label}</a>` +
    `</td></tr></table>`;

  if (!block.width || block.borderRadius <= 0) return table;

  // Height Outlook will use for the VML box, from the same numbers the CSS uses.
  const height = block.innerPadding[0] + block.innerPadding[2] + lineHeight;
  // VML's arcsize is a percentage of the shorter side, and 50% is already a full pill —
  // a borderRadius of 999 used to emit arcsize="2300%", which Word does not understand.
  const arcsize = `${num(Math.round((block.borderRadius / height) * 100), 0, 0, 50)}%`;
  const centerStyle = css({
    color: block.textColor,
    "font-family": fontFamily,
    "font-size": px(block.fontSize),
    "font-weight": "bold",
  });

  const vml =
    `<!--[if mso]>` +
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" ` +
    `href="${escAttr(href)}" style="height:${height}px;v-text-anchor:middle;width:${block.width}px;" ` +
    `arcsize="${arcsize}" stroke="f" fillcolor="${escAttr(block.backgroundColor)}">` +
    `<w:anchorlock/><center style="${escAttr(centerStyle)}">${label}</center>` +
    `</v:roundrect>` +
    `<![endif]-->`;

  // Outlook sees only the VML, every other client sees only the table.
  return `${vml}<!--[if !mso]><!-->${table}<!--<![endif]-->`;
}
