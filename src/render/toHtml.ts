import type {
  ColumnsBlock,
  MailDocument,
  RenderOptions,
  RenderResult,
  Spacing,
} from "../types.js";
import { walkBlocks } from "../document.js";
import { applyDataValues } from "./dataFields.js";
import { renderSection } from "./html/section.js";
import { mobilePaddingClass } from "./html/css.js";
import { spacing } from "./style.js";
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
  const mobilePaddings = collectMobilePaddings(doc);

  // One rule per distinct value, so a document that uses the same tight mobile padding on
  // thirty blocks emits one rule rather than thirty.
  const mobileClass = (padding: Spacing | undefined): string => {
    if (!padding) return "";
    const index = mobilePaddings.indexOf(spacing(padding));
    return index === -1 ? "" : ` class="${mobilePaddingClass(index)}"`;
  };

  const body = doc.blocks
    .map((section) => renderSection(section, { settings, width: settings.width, mobileClass }))
    .join("\n");

  const html = wrapDocument(settings, body, {
    lang: options.lang ?? "sv",
    title: options.title ?? "",
    stackGaps,
    mobilePaddings,
  });

  const text = toPlainText(doc);
  const onMissing = options.onMissingField ?? "keep";

  return {
    html: applyDataValues(html, options.data, { escape: "html", onMissing }),
    text: applyDataValues(text, options.data, { escape: "none", onMissing }),
  };
}

/** Distinct mobile paddings, as CSS shorthand, in a stable order for the golden files. */
function collectMobilePaddings(doc: MailDocument): string[] {
  const seen = new Set<string>();
  walkBlocks(doc, (block) => {
    if (block.mobilePadding) seen.add(spacing(block.mobilePadding));
  });
  return [...seen].sort();
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
