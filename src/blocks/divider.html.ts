import type { DividerBlock } from "../types.js";
import { escAttr } from "../render/esc.js";
import { TABLE_RESET, css, pct, px } from "../render/style.js";
import { align, num } from "../render/values.js";

/**
 * A one-cell table with a top border, not an <hr>. Clients disagree on <hr> colour,
 * thickness and surrounding margin; a bordered cell renders identically everywhere.
 * font-size and line-height are zeroed so the cell collapses to exactly the border.
 */
export function renderDivider(block: DividerBlock): string {
  // Percent of the row, and a thickness that has to be a real number of pixels.
  const width = num(block.width, 100, 0, 100);
  const thickness = num(block.thickness, 1, 0, 200);
  const cellStyle = css({
    "border-top": `${px(thickness)} solid ${block.color}`,
    "font-size": 0,
    "line-height": 0,
    height: px(thickness),
  });
  return (
    `<table${TABLE_RESET} align="${align(block.align, "center")}" width="${pct(width)}" ` +
    `style="${escAttr(css({ width: pct(width) }))}">` +
    `<tr><td style="${escAttr(cellStyle)}">&nbsp;</td></tr></table>`
  );
}
