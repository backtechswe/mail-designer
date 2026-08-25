import { sanitizeInline } from "../sanitize.js";

/**
 * Prepare author-written inline HTML for an email.
 *
 * Two rewrites happen here that cannot be done with inline styles on the container,
 * because email has no reliable descendant selectors:
 *
 *  - <p>, <ul>, <ol> get explicit margins. Client defaults for these differ wildly, and
 *    Outlook in particular adds a margin nothing else does.
 *  - <a> gets an explicit colour. Left alone, Gmail recolours links to its own blue and
 *    ignores the surrounding text colour.
 */
export function prepareInline(
  html: string,
  options: { linkColor: string; paragraphGap: number },
): string {
  const clean = sanitizeInline(html ?? "");
  const withMargins = addDefaultStyle(clean, ["p"], `margin:0 0 ${options.paragraphGap}px`, [
    "margin",
  ]);
  const withLists = addDefaultStyle(
    withMargins,
    ["ul", "ol"],
    `margin:0 0 ${options.paragraphGap}px;padding-left:24px`,
    ["margin", "padding"],
  );
  return addDefaultStyle(
    withLists,
    ["a"],
    `color:${options.linkColor};text-decoration:underline`,
    ["color"],
  );
}

/**
 * Merge declarations into a tag's style attribute, but only when the author has not
 * already set one of `skipIfPresent` — an explicit choice in the editor always wins.
 */
function addDefaultStyle(
  html: string,
  tags: string[],
  declarations: string,
  skipIfPresent: string[],
): string {
  const pattern = new RegExp(`<(${tags.join("|")})\\b([^>]*)>`, "gi");
  return html.replace(pattern, (whole, tag: string, rawAttrs: string) => {
    const styleMatch = /\sstyle\s*=\s*"([^"]*)"/i.exec(rawAttrs);
    const existing = styleMatch?.[1] ?? "";
    if (skipIfPresent.some((prop) => new RegExp(`(^|;)\\s*${prop}\\b`, "i").test(existing))) {
      return whole;
    }
    if (styleMatch) {
      const merged = existing.replace(/;\s*$/, "");
      const next = merged ? `${declarations};${merged}` : declarations;
      return whole.replace(styleMatch[0], ` style="${next}"`);
    }
    return `<${tag}${rawAttrs} style="${declarations}">`;
  });
}
