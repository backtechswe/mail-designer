import type { MailSettings } from "../../types.js";

/** Applied to column cells that should stack on narrow screens. */
export const STACK_CLASS = "md-col";

/** Companion class carrying the vertical gap to use once the columns have stacked. */
export function gapClass(gap: number): string {
  return `md-cg${Math.round(gap)}`;
}

/** Class for one distinct mobile padding, keyed by its position in the collected list. */
export function mobilePaddingClass(index: number): string {
  return `md-mp${index}`;
}

/** Marks the page background, the content surface, body text and links for dark mode. */
export const DARK_PAGE = "md-dark-page";
export const DARK_SURFACE = "md-dark-surface";
export const DARK_TEXT = "md-dark-text";
export const DARK_LINK = "md-dark-link";

/**
 * Dark mode, for the clients that have one.
 *
 * Three mechanisms, because the clients do three different things:
 *
 * - **Apple Mail, iOS Mail, Outlook for Mac** honour `prefers-color-scheme`, so a media query
 *   with `!important` reaches them. They also require `color-scheme` on `:root` and the two
 *   meta tags in the head; without those, Apple Mail decides the message is light-only and
 *   applies its own inversion instead.
 * - **Outlook.com** rewrites the DOM: it copies `bgcolor` to `data-ogsb` and colour styles to
 *   `data-ogsc`, then restyles from those. Selecting on those attributes is the only way to
 *   reach it, and it ignores media queries.
 * - **Gmail** has no dark mode for HTML mail at all on desktop, and on Android inverts nothing
 *   the author set explicitly. Setting the colours *is* the handling.
 *
 * What no mechanism fixes is an image: a PNG logo on white stays a white rectangle. That is
 * the author's problem to solve with a transparent asset, and `inspectEmail` says so.
 */
function darkRules(settings: MailSettings): string[] {
  const dark = settings.dark;
  if (!dark) return [];

  const declarations = (): string[] => {
    const out: string[] = [];
    if (dark.backgroundColor) {
      out.push(`.${DARK_PAGE}{background-color:${dark.backgroundColor}!important}`);
    }
    if (dark.contentBackgroundColor) {
      out.push(`.${DARK_SURFACE}{background-color:${dark.contentBackgroundColor}!important}`);
    }
    if (dark.textColor) {
      // The descendant selector matters: headings and text blocks set their own colour inline,
      // and inline beats a class unless the class is more specific and !important.
      out.push(`.${DARK_TEXT},.${DARK_TEXT} *{color:${dark.textColor}!important}`);
    }
    if (dark.linkColor) out.push(`.${DARK_LINK} a{color:${dark.linkColor}!important}`);
    return out;
  };

  const rules = declarations();
  if (rules.length === 0) return [];

  const ogsc: string[] = [];
  if (dark.backgroundColor) {
    ogsc.push(`[data-ogsb] .${DARK_PAGE}{background-color:${dark.backgroundColor}!important}`);
  }
  if (dark.contentBackgroundColor) {
    ogsc.push(
      `[data-ogsb] .${DARK_SURFACE}{background-color:${dark.contentBackgroundColor}!important}`,
    );
  }
  if (dark.textColor) {
    ogsc.push(`[data-ogsc] .${DARK_TEXT},[data-ogsc] .${DARK_TEXT} *{color:${dark.textColor}!important}`);
  }
  if (dark.linkColor) ogsc.push(`[data-ogsc] .${DARK_LINK} a{color:${dark.linkColor}!important}`);

  return [
    // Tells the client the mail has a dark treatment of its own, which is what stops Apple
    // Mail applying its automatic inversion on top.
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    `@media (prefers-color-scheme:dark){${rules.join("")}}`,
    ...ogsc,
  ];
}

/**
 * The only <style> block in the document.
 *
 * Everything in here is a rule that *cannot* be expressed inline: client-specific resets
 * and the one media query that stacks columns. Every visual decision that can be inline
 * is inline, because Outlook.com, older Yahoo and a few corporate gateways strip <head>
 * styles — a design that depends on this block would fall apart there.
 *
 * Outlook desktop ignores media queries entirely, which is exactly what we want: it is
 * always a wide viewport, so its columns should never stack.
 */
export function headCss(
  settings: MailSettings,
  stackGaps: readonly number[],
  mobilePaddings: readonly string[] = [],
): string {
  const rules: string[] = [
    // Kill the default page chrome.
    "body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}",
    // Without this, adjacent cells show hairline gaps in several clients.
    "table{border-collapse:collapse!important;mso-table-lspace:0pt;mso-table-rspace:0pt}",
    // display:block removes the descender gap under images; the rest are client resets.
    "img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}",
    // Outlook adds padding around links inside a container with an id.
    "#outlook a{padding:0}",
    // Outlook.com wraps content in .ExternalClass and imposes its own line height.
    ".ExternalClass{width:100%}",
    ".ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%}",
    // iOS turns dates, addresses and phone numbers into blue links; this recolours them.
    "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}",
    // Gmail on Android sometimes shrinks the whole message to fit.
    "u+#body a{color:inherit;text-decoration:none}",
  ];

  const mobileRules = mobilePaddings.map(
    (value, index) => `.${mobilePaddingClass(index)}{padding:${value}!important}`,
  );

  if (stackGaps.length > 0 || mobileRules.length > 0) {
    // One rule per distinct gap value, so a stacked column keeps the same breathing room
    // vertically that it had horizontally. The adjacent-sibling selector skips the first
    // column, which is what makes the spacing sit *between* them and not around them.
    const gapRules = [...new Set(stackGaps)]
      .sort((a, b) => a - b)
      .map((gap) => `.${gapClass(gap)}+.${gapClass(gap)}{padding-top:${gap}px!important}`)
      .join("");
    const stackRules =
      stackGaps.length > 0
        ? `.${STACK_CLASS}{display:block!important;width:100%!important;max-width:100%!important;padding-left:0!important;padding-right:0!important}` +
          gapRules
        : "";
    rules.push(
      `@media only screen and (max-width:${settings.width - 20}px){` +
        stackRules +
        mobileRules.join("") +
        `}`,
    );
  }

  rules.push(...darkRules(settings));

  return rules.join("\n");
}
