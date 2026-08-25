import type { ColumnsBlock, MailColumn } from "../../types.js";
import type { RenderContext } from "./context.js";
import { escAttr } from "../esc.js";
import { TABLE_RESET, css, pct, spacing } from "../style.js";
import { STACK_CLASS, gapClass } from "./css.js";

/**
 * Column widths as percentages that always total exactly 100.
 *
 * Columns with an explicit width keep it; the rest share what is left. The last flexible
 * column absorbs the rounding error, because a row that sums to 99.99% shows a hairline
 * gap in Outlook.
 */
export function computeWidths(columns: readonly MailColumn[]): number[] {
  if (columns.length === 0) return [];
  const fixed = columns.map((c) => (typeof c.width === "number" ? c.width : null));
  const fixedTotal = fixed.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const flexible = fixed.filter((w) => w === null).length;
  const share = flexible > 0 ? Math.max(0, 100 - fixedTotal) / flexible : 0;

  const widths = fixed.map((w) => (w === null ? share : w));
  const rounded = widths.map((w) => Math.round(w * 100) / 100);

  const drift = 100 - rounded.reduce((sum, w) => sum + w, 0);
  if (Math.abs(drift) > 0.001) {
    let target = rounded.length - 1;
    for (let i = rounded.length - 1; i >= 0; i -= 1) {
      if (fixed[i] === null) {
        target = i;
        break;
      }
    }
    rounded[target] = Math.round((rounded[target]! + drift) * 100) / 100;
  }
  return rounded;
}

/**
 * A single table row of cells.
 *
 * The gap is cell padding rather than a CSS gap, which does not exist in email. That works
 * because table cells size as border-box everywhere, so padding stays inside the declared
 * percentage instead of pushing the row over 100%.
 */
export function renderColumns(
  block: ColumnsBlock,
  ctx: RenderContext,
  renderChildren: (column: MailColumn, ctx: RenderContext) => string,
): string {
  const widths = computeWidths(block.columns);
  const half = Math.round(block.gap / 2);

  const cells = block.columns
    .map((column, index) => {
      const width = widths[index] ?? 0;
      const isFirst = index === 0;
      const isLast = index === block.columns.length - 1;
      const base = column.padding ?? [0, 0, 0, 0];
      const padding: [number, number, number, number] = [
        base[0],
        base[1] + (isLast ? 0 : half),
        base[2],
        base[3] + (isFirst ? 0 : half),
      ];

      // Inner width in px so nested images and VML buttons get a real number.
      const innerWidth = Math.max(
        1,
        Math.round((ctx.width * width) / 100) - padding[1] - padding[3],
      );

      const classes = block.stackOnMobile
        ? ` class="${STACK_CLASS} ${gapClass(block.gap)}"`
        : "";
      const style = css({
        width: pct(width),
        padding: spacing(padding),
        "background-color": column.backgroundColor,
        "vertical-align": column.verticalAlign ?? "top",
      });

      const inner = renderChildren(column, { ...ctx, width: innerWidth });
      return (
        `<td${classes} width="${pct(width)}" valign="${column.verticalAlign ?? "top"}" ` +
        `style="${escAttr(style)}">${inner}</td>`
      );
    })
    .join("");

  return (
    `<table${TABLE_RESET} width="100%" style="${escAttr(css({ width: "100%" }))}">` +
    `<tr>${cells}</tr></table>`
  );
}
