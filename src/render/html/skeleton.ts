import type { MailSettings } from "../../types.js";
import { escAttr, escText } from "../esc.js";
import { TABLE_RESET, css, px } from "../style.js";
import { DARK_LINK, DARK_PAGE, DARK_TEXT, headCss } from "./css.js";

export interface SkeletonOptions {
  lang: string;
  title: string;
  /** Distinct column gaps that need a stacked-mobile rule. */
  stackGaps: readonly number[];
  /** Distinct mobile paddings, as CSS shorthand. */
  mobilePaddings: readonly string[];
}

/**
 * The document frame. Nearly every line here is a workaround for a specific client, so
 * each one is commented — a future reader must be able to tell a load-bearing hack from
 * decoration before deleting it.
 */
export function wrapDocument(
  settings: MailSettings,
  body: string,
  options: SkeletonOptions,
): string {
  const preheader = settings.preheader ? renderPreheader(settings.preheader) : "";
  /*
   * Hooks for the dark rules in headCss, emitted only when the document has a dark treatment —
   * an unused class in every mail is noise, and bytes count against Gmail's clipping limit.
   *
   * bgcolor on the page table alongside the CSS is unrelated to dark mode and was missing: a
   * comment in columns.ts says older Outlook and some gateways drop background-color from a
   * cell but honour the attribute, and the page background is exactly the one that fell back
   * to white in those clients.
   */
  const dark = settings.dark;
  // One class per colour the document actually defines. A class with no rule behind it is
  // markup in every mail that does nothing.
  const bodyHooks = [
    dark?.backgroundColor ? DARK_PAGE : "",
    dark?.textColor ? DARK_TEXT : "",
    dark?.linkColor ? DARK_LINK : "",
  ].filter(Boolean);
  const bodyClass = bodyHooks.length > 0 ? ` class="${bodyHooks.join(" ")}"` : "";
  const pageClass = dark?.backgroundColor ? ` class="${DARK_PAGE}"` : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${escAttr(options.lang)}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!-- Stops Apple Mail from re-flowing the layout on its own. -->
<meta name="x-apple-disable-message-reformatting" />
<!-- Stops iOS from auto-linking phone numbers, dates and addresses. -->
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />${
    settings.dark
      ? `
<!-- Both are needed: without them Apple Mail treats the message as light-only and applies
     its own inversion instead of honouring the dark rules below. -->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />`
      : ""
  }
<title>${escText(options.title)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style type="text/css">
${headCss(settings, options.stackGaps, options.mobilePaddings)}
</style>
</head>
<body id="body"${bodyClass} style="${escAttr(
    css({
      margin: 0,
      padding: 0,
      "background-color": settings.backgroundColor,
      "font-family": settings.fontFamily,
      "font-size": px(settings.fontSize),
      "line-height": px(Math.round(settings.fontSize * settings.lineHeight)),
      color: settings.textColor,
    }),
  )}">
${preheader}
<table${TABLE_RESET} width="100%"${pageClass} bgcolor="${escAttr(settings.backgroundColor)}" style="${escAttr(
    css({ width: "100%", "background-color": settings.backgroundColor }),
  )}">
<tr><td align="center" style="padding:0">
${body}
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Hidden preview text. Without it the inbox shows the first words of the body, which for
 * a mail that opens with a logo means showing nothing useful at all.
 *
 * The trailing filler is deliberate: it pushes the body copy out of the preview window so
 * only the intended sentence shows. mso-hide:all is what hides it in Outlook, where
 * display:none is not enough.
 */
function renderPreheader(text: string): string {
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="${escAttr(
    css({
      display: "none",
      "font-size": "1px",
      "line-height": "1px",
      "max-height": 0,
      "max-width": 0,
      opacity: 0,
      overflow: "hidden",
      "mso-hide": "all",
    }),
  )}">${escText(text)}${filler}</div>`;
}
