import type {
  ColumnsBlock,
  EmailWarning,
  MailDocument,
  RenderOptions,
  RenderResult,
  Spacing,
} from "../types.js";
import { defaultSettings, walkBlocks } from "../document.js";
import { applyDataValues, extractDataFields } from "./dataFields.js";
import { neutraliseUrls } from "./esc.js";
import { pruneEmptyBlocks } from "./conditional.js";
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
  /*
   * Defaults merged here, not assumed. A document is JSON from a database, an API or a hand
   * written file, and `validateDocument` requires a settings *object* rather than every field
   * in it — so a partial one used to render `font-size:undefinedpx` and `margin:0 0 NaNpx`
   * into the mail. Partial settings are the normal shape of a machine-written document.
   */
  const settings = { ...defaultSettings, ...doc.settings };

  // Before anything is measured or rendered, so the media queries, the plain-text
  // alternative and the HTML all describe the same mail. A document with no hideWhenEmpty
  // anywhere comes back untouched.
  const pruned = pruneEmptyBlocks(doc, options.data);
  doc = pruned.doc;
  const warnings = conditionalWarnings(pruned.droppedForMissingValue, options);

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
    lang: options.lang ?? "en",
    title: options.title ?? "",
    stackGaps,
    mobilePaddings,
  });

  const text = toPlainText(doc);
  const onMissing = options.onMissingField ?? "keep";
  // Scoped to what this document declares, so substitution cannot reach the brackets the
  // renderer wrote itself — the MSO conditionals and the Outlook.com dark-mode selectors.
  const fields = extractDataFields(doc);

  return {
    // neutraliseUrls runs *after* substitution, and that order is the point: a token in an
    // href passes safeUrl at render time as the harmless string it is, and only becomes a
    // URL once a recipient row is applied. Recipient data comes from outside.
    html: neutraliseUrls(applyDataValues(html, options.data, { escape: "html", onMissing, fields, raw: options.rawFields })),
    text: applyDataValues(text, options.data, { escape: "none", onMissing, fields, raw: options.rawFields }),
    warnings,
  };
}

/** Said once per process. A send loop would otherwise print this ten thousand times. */
let saidItOnce = false;

/**
 * The one way `hideWhenEmpty` fails silently, named out loud.
 *
 * Render once, substitute in an ESP later, and a conditional block matches nothing at render
 * time — so it is dropped from the HTML that gets stored, and no later substitution can bring
 * it back for the recipients whose row would have filled it. Nothing throws, the mail looks
 * fine, and the missing paragraph is only ever noticed by the person who did not receive it.
 *
 * Only when `data` was not supplied at all. With data, a dropped block is the feature working:
 * that recipient genuinely has no value, which is the whole point of asking for the block to
 * be hidden.
 */
function conditionalWarnings(dropped: string[], options: RenderOptions): EmailWarning[] {
  if (dropped.length === 0 || options.data !== undefined) return [];
  if (!saidItOnce) {
    saidItOnce = true;
    console.warn(
      `[mail-designer] ${dropped.length} block(s) with hideWhenEmpty were dropped because ` +
        `toHtml was called without \`data\`. hideWhenEmpty is decided at render time, so this ` +
        `HTML is missing them for every recipient — render once per recipient with ` +
        `toHtml(doc, { data }) instead of substituting downstream. Blocks: ${dropped.join(", ")}.`,
    );
  }
  return [{ id: "conditional-without-data", level: "error", blocks: [...dropped] }];
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
