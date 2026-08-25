import type { DividerBlock } from "../types.js";
import { escAttr } from "../render/esc.js";
import { TABLE_RESET, css, pct, px } from "../render/style.js";

/**
 * A one-cell table with a top border, not an <hr>. Clients disagree on <hr> colour,
 * thickness and surrounding margin; a bordered cell renders identically everywhere.
 * font-size and line-height are zeroed so the cell collapses to exactly the border.
 */
export function renderDivider(block: DividerBlock): string {
  const cellStyle = css({
    "border-top": `${px(block.thickness)} solid ${block.color}`,
    "font-size": 0,
    "line-height": 0,
    height: px(block.thickness),
  });
  return (
    `<table${TABLE_RESET} align="${block.align}" width="${pct(block.width)}" ` +
    `style="${escAttr(css({ width: pct(block.width) }))}">` +
    `<tr><td style="${escAttr(cellStyle)}">&nbsp;</td></tr></table>`
  );
}
