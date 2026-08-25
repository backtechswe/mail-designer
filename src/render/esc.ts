/** Escaping and URL safety. Small on purpose — these run on every node we emit. */

const TEXT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const ATTR: Record<string, string> = { ...TEXT, '"': "&quot;", "'": "&#39;" };

/** For text nodes: the three characters that can end a text context. */
export function escText(value: string): string {
  return value.replace(/[&<>]/g, (c) => TEXT[c] as string);
}

/** For attribute values: also the quote characters. */
export function escAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ATTR[c] as string);
}

const NAMED: Record<string, string> = {
  colon: ":",
  tab: "\t",
  newline: "\n",
  amp: "&",
  lpar: "(",
  rpar: ")",
  sol: "/",
};

/**
 * Decode enough of HTML's entity syntax to see through an obfuscated scheme.
 *
 * Not a general decoder — it exists so `&#106;avascript:` and `javascript&colon;` cannot walk
 * past a scheme test that only understands `javascript:`. Browsers decode entities before
 * they parse a URL, so a filter that does not is testing a string the browser will never see.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/**
 * The scheme a browser will actually resolve: entities decoded, and every control character
 * removed. Browsers strip tab, newline and NUL from a URL *before* reading its scheme, so
 * "java\tscript:alert(1)" runs — and matches no naive regex.
 */
function schemeOf(value: string): string {
  const decoded = decodeEntities(value).replace(/[\u0000-\u0020\u007f]/g, "");
  return /^([a-z][a-z0-9+.-]*):/i.exec(decoded)?.[1]?.toLowerCase() ?? "";
}

/** Schemes that can execute, or that smuggle a whole document in behind a link. */
const UNSAFE_LINK = new Set(["javascript", "vbscript", "data", "file", "blob"]);
/** For images, `data:` is legitimate — inline base64 is a real, if Gmail-blocked, choice. */
const UNSAFE_IMAGE = new Set(["javascript", "vbscript", "file", "blob"]);

/**
 * Neutralise a link target. Anything with an executable scheme becomes "#" rather than
 * being dropped, so the layout stays intact and the dead link is visible in review.
 */
export function safeUrl(value: string): string {
  const url = (value ?? "").trim();
  if (!url) return "";
  return UNSAFE_LINK.has(schemeOf(url)) ? "#" : url;
}

/**
 * Image sources may be data: URIs — inline base64 is legitimate here even though Gmail
 * blocks it, so we keep it and let the sender find out in a test send.
 */
export function safeImageUrl(value: string): string {
  const url = (value ?? "").trim();
  if (!url) return "";
  return UNSAFE_IMAGE.has(schemeOf(url)) ? "" : url;
}

const URL_ATTRIBUTE = /\s(href|src|background)="([^"]*)"/gi;

/**
 * A last pass over finished HTML, neutralising any URL that became dangerous after it was
 * emitted.
 *
 * It exists for one specific hole: data values are substituted into the rendered string, so
 * `href="[Link]"` passes `safeUrl` as a harmless token and only then becomes whatever the
 * recipient row says — `javascript:alert(1)` included. Recipient data comes from a CRM, a
 * form, or an uploaded spreadsheet: from outside.
 *
 * Safe as a regex only because it runs on markup this renderer produced, where every
 * attribute is double-quoted and every value already escaped.
 */
export function neutraliseUrls(html: string): string {
  return html.replace(URL_ATTRIBUTE, (whole, name: string, value: string) => {
    const lower = name.toLowerCase();
    const unsafe = lower === "href" ? UNSAFE_LINK : UNSAFE_IMAGE;
    if (!unsafe.has(schemeOf(value))) return whole;
    return lower === "href" ? ` ${name}="#"` : ` ${name}=""`;
  });
}

/**
 * A CSS value that cannot break out of the declaration it sits in.
 *
 * Every colour, font stack and background URL in the document model reaches the output by
 * string concatenation, so `red;background:url(http://tracker/x)` in a colour field is a
 * working tracking beacon in every mail sent. Semicolons and braces end the declaration;
 * `expression` and `behavior` are the Word-engine vectors, and this renderer targets the
 * Word engine on purpose.
 */
/**
 * Colour syntax, roughly: hex, one of the functional notations, or a bare keyword.
 *
 * Applied only to properties whose name ends in "color", which is where the document model
 * lets a user type free text. `red;background:url(http://tracker/x)` survives the generic
 * cleaner as one long invalid value; here it fails the pattern and the declaration is
 * dropped, which is what stops the tracker reaching the mail.
 */
const COLOUR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|color|color-mix)\([^()]*\)|[a-z]+)$/i;

export function isColour(value: string): boolean {
  return COLOUR.test(value.trim());
}

export function safeCssValue(value: string): string {
  const cleaned = String(value ?? "")
    .replace(/[;{}<>\\]/g, "")
    .trim();
  if (/expression\s*\(|behaviou?r\s*:|@import|(javascript|vbscript)\s*:/i.test(cleaned)) return "";
  return cleaned.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (whole, _q: string, url: string) =>
    UNSAFE_IMAGE.has(schemeOf(url)) ? "" : whole,
  );
}
