import type { MailSettings } from "../../types.js";

/** Applied to column cells that should stack on narrow screens. */
export const STACK_CLASS = "md-col";

/** Companion class carrying the vertical gap to use once the columns have stacked. */
export function gapClass(gap: number): string {
  return `md-cg${Math.round(gap)}`;
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
export function headCss(settings: MailSettings, stackGaps: readonly number[]): string {
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

  if (stackGaps.length > 0) {
    // One rule per distinct gap value, so a stacked column keeps the same breathing room
    // vertically that it had horizontally. The adjacent-sibling selector skips the first
    // column, which is what makes the spacing sit *between* them and not around them.
    const gapRules = [...new Set(stackGaps)]
      .sort((a, b) => a - b)
      .map((gap) => `.${gapClass(gap)}+.${gapClass(gap)}{padding-top:${gap}px!important}`)
      .join("");
    rules.push(
      `@media only screen and (max-width:${settings.width - 20}px){` +
        `.${STACK_CLASS}{display:block!important;width:100%!important;max-width:100%!important;padding-left:0!important;padding-right:0!important}` +
        gapRules +
        `}`,
    );
  }

  return rules.join("\n");
}
