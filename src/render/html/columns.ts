import type { ColumnsBlock, MailColumn } from "../../types.js";
import type { RenderContext } from "./context.js";
import { escAttr } from "../esc.js";
import { TABLE_RESET, css, pct, spacing } from "../style.js";
import { STACK_CLASS, gapClass } from "./css.js";

export interface WidthOptions {
  /** Row width in px. Required to make the gap come out of the right columns. */
  totalWidth?: number;
  gap?: number;
}

/**
 * Column widths as percentages that always total exactly 100.
 *
 * Columns with an explicit width keep it; the rest share what is left. The last flexible
 * column absorbs the rounding error, because a row that sums to 99.99% shows a hairline gap
 * in Outlook.
 *
 * The gap is the subtle part. It has to live inside a cell as padding — email has no CSS
 * gap — which means whichever cells carry it end up with less room for their contents.
 * Splitting it half-and-half onto both sides of every column looks even but is not: with
 * three columns the middle one carries a full gap while the outer two carry half, so its
 * image renders visibly narrower than its neighbours'. Instead the gap goes entirely on the
 * right of every column but the last, and the *percentages* are widened to compensate — so
 * every column ends up with exactly the same content width and the row still runs flush to
 * both edges.
 */
export function computeWidths(
  columns: readonly MailColumn[],
  options: WidthOptions = {},
): number[] {
  if (columns.length === 0) return [];
  const fixed = columns.map((c) => (typeof c.width === "number" ? c.width : null));
  const fixedTotal = fixed.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const flexible = fixed.filter((w) => w === null).length;
  const share = flexible > 0 ? Math.max(0, 100 - fixedTotal) / flexible : 0;

  const widths = fixed.map((w) => (w === null ? share : w));
  const rounded = widths.map((w) => Math.round(w * 100) / 100);

  const { totalWidth, gap = 0 } = options;
  const gapCount = columns.length - 1;
  let boxes = rounded;

  if (totalWidth && totalWidth > 0 && gap > 0 && gapCount > 0) {
    const contentTotal = Math.max(1, totalWidth - gap * gapCount);
    boxes = rounded.map((share, index) => {
      const contentPx = (share / 100) * contentTotal;
      const boxPx = contentPx + (index < gapCount ? gap : 0);
      return Math.round((boxPx / totalWidth) * 10000) / 100;
    });
  }

  const drift = 100 - boxes.reduce((sum, w) => sum + w, 0);
  if (Math.abs(drift) > 0.001) {
    let target = boxes.length - 1;
    for (let i = boxes.length - 1; i >= 0; i -= 1) {
      if (fixed[i] === null) {
        target = i;
        break;
      }
    }
    boxes[target] = Math.round((boxes[target]! + drift) * 100) / 100;
  }
  return boxes;
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
  const widths = computeWidths(block.columns, { totalWidth: ctx.width, gap: block.gap });

  const cells = block.columns
    .map((column, index) => {
      const width = widths[index] ?? 0;
      const isLast = index === block.columns.length - 1;
      const base = column.padding ?? [0, 0, 0, 0];
      const padding: [number, number, number, number] = [
        base[0],
        base[1] + (isLast ? 0 : block.gap),
        base[2],
        base[3],
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
