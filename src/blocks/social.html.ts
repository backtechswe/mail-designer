import type { SocialBlock } from "../types.js";
import { escAttr, safeImageUrl, safeUrl } from "../render/esc.js";
import { TABLE_RESET, css, px } from "../render/style.js";
import { align } from "../render/values.js";

/**
 * Icons sit in one row of table cells rather than inline-blocks, because Outlook collapses
 * whitespace between inline elements unpredictably and a table row simply does not.
 *
 * Icon URLs must be absolute and publicly reachable — Gmail refuses data: URIs in <img>,
 * so inlining them is not an option. See resolveSocialIcon in the editor props.
 */
export function renderSocial(block: SocialBlock): string {
  const items = block.items.filter((item) => safeImageUrl(item.iconUrl));
  if (items.length === 0) return "";

  const cells = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      const cellStyle = css({
        padding: isLast ? 0 : `0 ${px(block.spacing)} 0 0`,
        "font-size": 0,
        "line-height": 0,
      });
      const img =
        `<img src="${escAttr(safeImageUrl(item.iconUrl))}" ` +
        `alt="${escAttr(item.label ?? item.network)}" ` +
        `width="${block.iconSize}" height="${block.iconSize}" border="0" ` +
        `style="${escAttr(
          css({
            display: "block",
            width: px(block.iconSize),
            height: px(block.iconSize),
            border: 0,
          }),
        )}" />`;
      const href = safeUrl(item.href);
      const content = href
        ? `<a href="${escAttr(href)}" target="_blank" style="text-decoration:none;border:0">${img}</a>`
        : img;
      return `<td style="${escAttr(cellStyle)}">${content}</td>`;
    })
    .join("");

  return `<table${TABLE_RESET} align="${align(block.align, "center")}"><tr>${cells}</tr></table>`;
}
