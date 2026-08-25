import type { ColumnsBlock, MailDocument, RenderOptions, RenderResult } from "../types.js";
import { walkBlocks } from "../document.js";
import { applyDataValues } from "./dataFields.js";
import { renderSection } from "./html/section.js";
import { wrapDocument } from "./html/skeleton.js";
import { toPlainText } from "./toPlainText.js";

/**
 * Document -> email HTML. Pure string building: no DOM, no dependencies, identical output
 * in a browser and in Node. That single code path is the point — the preview a user
 * approves and the mail a server sends are byte-for-byte the same.
 *
 * Merge values are applied *after* the HTML is assembled, so one render can serve a whole
 * recipient list.
 */
export function toHtml(doc: MailDocument, options: RenderOptions = {}): RenderResult {
  const { settings } = doc;
  const stackGaps = collectStackGaps(doc);

  const body = doc.blocks
    .map((section) => renderSection(section, { settings, width: settings.width }))
    .join("\n");

  const html = wrapDocument(settings, body, {
    lang: options.lang ?? "sv",
    title: options.title ?? "",
    stackGaps,
  });

  const text = toPlainText(doc);
  const onMissing = options.onMissingField ?? "keep";

  return {
    html: applyDataValues(html, options.data, { escape: "html", onMissing }),
    text: applyDataValues(text, options.data, { escape: "none", onMissing }),
  };
}

/** Gaps that need a stacked-mobile rule. Empty means we emit no media query at all. */
function collectStackGaps(doc: MailDocument): number[] {
  const gaps: number[] = [];
  walkBlocks(doc, (block) => {
    if (block.type !== "columns") return;
    const columns = block as ColumnsBlock;
    if (columns.stackOnMobile) gaps.push(columns.gap);
  });
  return gaps;
}
