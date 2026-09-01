import type { MailColumn, SectionBlock, SectionChild } from "../../types.js";
import type { RenderContext } from "./context.js";
import { escAttr } from "../esc.js";
import { TABLE_RESET, css, px, spacing } from "../style.js";
import { renderColumns } from "./columns.js";
import { renderLeaf } from "./leaf.js";
import { DARK_LINK, DARK_SURFACE, DARK_TEXT } from "./css.js";

/**
 * One section becomes two nested tables: a full-width outer one, and a *fluid* inner one
 * capped at settings.width.
 *
 * The inner table is `width="100%"` with `max-width`, not a fixed pixel width. That matters:
 * a fixed-width table cannot shrink, so on a 360 px phone a 600 px email scrolls sideways —
 * which is exactly the bug this shape avoids. Outlook, however, ignores max-width entirely
 * and would then stretch the content across the whole window, so it gets a conditional
 * "ghost table" of the real width instead. Every other client skips those comments.
 *
 * `fullWidth` decides which table carries the background:
 *   true  -> the outer table, so the colour bleeds edge to edge on a wide screen
 *   false -> the inner table, so the colour stays inside the content column
 */
export function renderSection(section: SectionBlock, ctx: RenderContext): string {
  const { settings } = ctx;
  const padding = section.padding ?? [0, 0, 0, 0];
  const contentWidth = Math.max(1, settings.width - padding[1] - padding[3]);

  const outerBackground = section.fullWidth ? section.backgroundColor : undefined;
  const innerBackground = section.fullWidth
    ? undefined
    : (section.backgroundColor ?? settings.contentBackgroundColor);

  const outerStyle = css({
    width: "100%",
    "background-color": outerBackground,
    "background-image": section.backgroundUrl ? `url('${section.backgroundUrl}')` : undefined,
    "background-position": section.backgroundUrl ? "center" : undefined,
    "background-size": section.backgroundUrl ? "cover" : undefined,
  });

  const innerStyle = css({
    width: "100%",
    "max-width": px(settings.width),
    "background-color": innerBackground,
  });

  const body = renderChildren(section.children, { ...ctx, width: contentWidth });

  const sectionMobile = ctx.mobileClass(section.mobilePadding);
  /*
   * The dark hooks, per section rather than on <body>, and all three governed by the same
   * question: did the author choose this section's background themselves?
   *
   * If they did, dark mode leaves the whole section alone. Repainting the background would
   * throw the choice away — a coloured band is usually the one thing meant to stay — and
   * repainting only the *text* is worse than either: `.md-dark-text *` reaches into the band
   * from <body>, so a tinted section kept its light background and got light text on top of
   * it. Every tinted section was unreadable in dark mode, and nothing in the editor showed it.
   *
   * A section that takes its surface from settings has made no such choice, so it gets the
   * full treatment; one that painted itself keeps the contrast it was designed with.
   */
  const dark = settings.dark;
  const ownBackground = Boolean(section.backgroundColor);
  const hooks = [
    dark?.contentBackgroundColor && !section.fullWidth && !ownBackground ? DARK_SURFACE : "",
    dark?.textColor && !ownBackground ? DARK_TEXT : "",
    dark?.linkColor && !ownBackground ? DARK_LINK : "",
  ].filter(Boolean);
  const surfaceClass = hooks.length > 0 ? ` class="${hooks.join(" ")}"` : "";

  return (
    `<table${TABLE_RESET} width="100%" style="${escAttr(outerStyle)}"` +
    (outerBackground ? ` bgcolor="${escAttr(outerBackground)}"` : "") +
    `><tr><td align="center" style="padding:0">` +
    `<!--[if mso]><table${TABLE_RESET} align="center" width="${settings.width}"><tr><td style="padding:0"><![endif]-->` +
    `<table${TABLE_RESET} align="center" width="100%"${surfaceClass} style="${escAttr(innerStyle)}"` +
    (innerBackground ? ` bgcolor="${escAttr(innerBackground)}"` : "") +
    `><tr><td${sectionMobile} style="${escAttr(css({ padding: spacing(padding) }))}">` +
    body +
    `</td></tr></table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table>`
  );
}

/**
 * Children become one table row each. Giving every block its own row is what makes
 * vertical spacing predictable: the block's padding lives on its own cell and cannot
 * collapse into a neighbour's, which is the failure mode of stacking divs in email.
 */
export function renderChildren(children: readonly SectionChild[], ctx: RenderContext): string {
  const rows = children
    .map((child) => {
      const padding = child.padding ?? [0, 0, 0, 0];
      const inner =
        child.type === "columns"
          ? renderColumns(child, ctx, renderColumnChildren)
          : renderLeaf(child, ctx);
      if (!inner) return "";
      return (
        `<tr><td${ctx.mobileClass(child.mobilePadding)} ` +
        `style="${escAttr(css({ padding: spacing(padding) }))}">` +
        inner +
        `</td></tr>`
      );
    })
    .filter(Boolean)
    .join("");

  if (!rows) return "";
  return `<table${TABLE_RESET} width="100%" style="${escAttr(css({ width: "100%" }))}">${rows}</table>`;
}

function renderColumnChildren(column: MailColumn, ctx: RenderContext): string {
  return renderChildren(column.children, ctx);
}
