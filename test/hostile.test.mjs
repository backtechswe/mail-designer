/**
 * A deliberately hostile document, and the payloads that got through before.
 *
 * The existing invariants — no `on*` attributes, no `<script>` — were correct and useless,
 * because they only ever ran over two well-formed fixtures. Every value below reproduced a
 * real injection against the built package; the point of this file is that they cannot come
 * back quietly.
 *
 * The threat model is not a hostile author typing into their own editor. It is a document
 * from a shared catalogue or another tenant, and recipient data from a CRM, a form or an
 * uploaded spreadsheet — all of which reach `dangerouslySetInnerHTML` in the canvas and the
 * preview iframe's srcDoc.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { toHtml } from "../dist/render/toHtml.js";
import { sanitize, sanitizeBlock, sanitizeInline } from "../dist/render/sanitize.js";
import { safeUrl, safeImageUrl, safeCssValue, neutraliseUrls } from "../dist/render/esc.js";

const section = (children) => ({ id: "s", type: "section", children });
const doc = (children, settings = {}) => ({ version: 1, settings, blocks: [section(children)] });
const text = (html) => ({ id: "t", type: "text", html, align: "left" });

/* ------------------------------------------------------------------ the sanitiser */

test("a tag with an unbalanced quote is dropped, not passed through", () => {
  // The old tokeniser required a balanced pair, so this matched nothing and String.replace
  // emitted it verbatim. A parser reads title=" to the next quote and runs the handler.
  const out = sanitizeInline('<img src=x onerror=alert(1) title=">');
  assert.doesNotMatch(out, /onerror/i);
  assert.doesNotMatch(out, /<img/i);
});

test("a tag with no closing bracket is dropped", () => {
  assert.doesNotMatch(sanitizeInline("<img src=x onerror=alert(1)"), /onerror/i);
});

test("a literal < in prose is escaped rather than emitted", () => {
  assert.equal(sanitizeInline("<p>3 < 4</p>"), "<p>3 &lt; 4</p>");
});

test("control characters cannot hide a scheme", () => {
  for (const url of ["java\tscript:alert(1)", "java\nscript:alert(1)", "java\0script:alert(1)"]) {
    // Browsers strip these before reading the scheme, so a filter that does not is testing a
    // string the browser will never see.
    assert.doesNotMatch(sanitizeInline(`<a href="${url}">x</a>`), /href/i, url);
    assert.equal(safeUrl(url), "#", url);
  }
});

test("entity-encoded schemes cannot hide either", () => {
  for (const url of ["&#106;avascript:alert(1)", "&#x6a;avascript&colon;alert(1)"]) {
    assert.doesNotMatch(sanitizeInline(`<a href="${url}">x</a>`), /href/i, url);
    assert.equal(safeUrl(url), "#", url);
  }
});

test("data: is a link scheme we refuse, and an image scheme we allow", () => {
  assert.equal(safeUrl("data:text/html,<script>alert(1)</script>"), "#");
  assert.equal(safeImageUrl("data:image/png;base64,iVBOR"), "data:image/png;base64,iVBOR");
  assert.equal(safeImageUrl("javascript:alert(1)"), "");
});

test("attribute values are escaped, not just quote-stripped", () => {
  // A raw > here ends the tag as far as the next regex transform is concerned, and the
  // renderer runs several after this one.
  const out = sanitizeInline('<p style="font:a>b">x</p>');
  assert.doesNotMatch(out.slice(0, out.indexOf(">") + 1), />.*>/);
});

test("a raw > in an attribute cannot splice a second attribute into the first", () => {
  const html = toHtml(doc([text('<p style="font:a>b">x</p>')])).html;
  // The failure shape was: <p style="font:a style="margin:0 0 12px">b">
  assert.doesNotMatch(html, /style="[^"]*style=/);
});

test("an html block cannot close the renderer's own tables", () => {
  const out = sanitizeBlock("</td></tr></table><table><tr><td>escaped");
  // Stray closing tags are dropped; what the author opened is closed for them.
  assert.equal(out, "<table><tr><td>escaped</td></tr></table>");
});

test("the section structure survives a breakout attempt in a document", () => {
  const html = toHtml(doc([{ id: "x", type: "html", html: "</td></tr></table>after" }])).html;
  const open = (html.match(/<table/g) ?? []).length;
  const close = (html.match(/<\/table>/g) ?? []).length;
  assert.equal(open, close, "tables balance");
});

test("expression() and behavior: are refused in a style attribute", () => {
  for (const style of ["width:expression(alert(1))", "behavior:url(evil.htc)", "@import 'x'"]) {
    assert.doesNotMatch(sanitizeInline(`<p style="${style}">x</p>`), /style=/, style);
  }
});

test("sanitising is idempotent", () => {
  // TextEditable writes innerHTML, reads it back and sanitises again on every edit, so a
  // transformation that is not stable would drift the document with each keystroke.
  const cases = [
    "<p>Hi <b>du</b></p>",
    '<a href="https://example.com">x</a>',
    "<p>3 < 4</p>",
    '<img src=x onerror=alert(1) title=">',
    "</td></tr></table><table><tr><td>x",
    "<b>unclosed",
  ];
  for (const html of cases) {
    const once = sanitize(html);
    assert.equal(sanitize(once), once, html);
  }
});

/* ---------------------------------------------------------- the document as an attack */

test("an enum from a stored document cannot become markup", () => {
  const html = toHtml(
    doc([
      {
        id: "d",
        type: "divider",
        color: "#000",
        thickness: 1,
        width: 100,
        align: 'left"><script>alert(1)</script><x y="',
      },
    ]),
  ).html;
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /align="center"/, "an unknown alignment falls back rather than escaping");
});

test("out-of-range numbers cannot reach the output", () => {
  const html = toHtml(
    doc([
      { id: "h", type: "heading", level: 9, html: "Hi", align: "left" },
      { id: "s2", type: "spacer", height: Number.NaN },
      { id: "t2", type: "text", html: "<p>x</p>", align: "left", fontSize: "big" },
    ]),
  ).html;
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(html, /<h2/, "level 9 renders as a real heading level");
});

test("partial settings render defaults rather than undefined", () => {
  // The normal shape of a machine-written document: a few fields, not all of them.
  const html = toHtml({ version: 1, settings: { width: 480 }, blocks: [section([text("<p>x</p>")])] }).html;
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(html, /max-width:480px/);
});

test("a colour field cannot carry a second declaration", () => {
  const html = toHtml(doc([text("<p>x</p>")], {
    textColor: "red;background:url(http://tracker.example/x)",
  })).html;
  assert.doesNotMatch(html, /tracker\.example/);
});

test("a background URL with an executable scheme is dropped", () => {
  const html = toHtml({
    version: 1,
    settings: {},
    blocks: [{ ...section([text("<p>x</p>")]), backgroundUrl: "javascript:alert(1)" }],
  }).html;
  assert.doesNotMatch(html, /javascript:/i);
});

test("safeCssValue keeps legitimate values intact", () => {
  // The guard must not be so eager that it breaks ordinary documents.
  assert.equal(safeCssValue("#ffffff"), "#ffffff");
  assert.equal(safeCssValue("Georgia, 'Times New Roman', serif"), "Georgia, 'Times New Roman', serif");
  assert.equal(safeCssValue("url('https://example.com/a.png')"), "url('https://example.com/a.png')");
  assert.equal(safeCssValue("0px 40px 0px 40px"), "0px 40px 0px 40px");
});

/* ------------------------------------------------------------ recipient data as an attack */

test("a data value cannot turn a link into a javascript: URL", () => {
  const html = toHtml(
    doc([
      {
        id: "b",
        type: "button",
        label: "Klicka",
        href: "[Link]",
        backgroundColor: "#000",
        textColor: "#fff",
        borderRadius: 4,
        fontSize: 16,
        innerPadding: [10, 20, 10, 20],
        align: "left",
        width: 200,
      },
    ]),
    { data: { Link: "javascript:alert(1)" } },
  ).html;
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /href="#"/);
});

test("a data value cannot turn an image source into one either", () => {
  const html = toHtml(
    doc([{ id: "i", type: "image", src: "[Bild]", alt: "", align: "center" }]),
    { data: { Bild: "javascript:alert(1)" } },
  ).html;
  assert.doesNotMatch(html, /javascript:/i);
});

test("neutraliseUrls leaves ordinary links alone", () => {
  const html = '<a href="https://example.com/x?a=1&amp;b=2">x</a><img src="https://x/y.png" />';
  assert.equal(neutraliseUrls(html), html);
});

test("a data value is escaped into text, not injected as markup", () => {
  const html = toHtml(doc([text("<p>Hi [Name]</p>")]), {
    data: { Name: '<script>alert(1)</script>' },
  }).html;
  assert.doesNotMatch(html, /<script/i);
});

/* ----------------------------------------------------------------- the invariants, held */

test("the hostile document still satisfies every invariant the fixtures assert", () => {
  const html = toHtml(
    doc([
      { id: "d", type: "divider", color: "#000", thickness: 1, width: 100, align: "nope" },
      { id: "h", type: "heading", level: 9, html: '<h2 onclick="x">Hi</h2>', align: "left" },
      text('<a href="javascript:alert(1)">x</a>'),
      { id: "x", type: "html", html: '<script>alert(1)</script><td onmouseover="x">y' },
    ]),
    { data: { Any: "javascript:alert(1)" } },
  ).html;

  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "no event handlers");
  assert.doesNotMatch(html, /<script/i, "no script tags");
  assert.doesNotMatch(html, /javascript:/i, "no executable schemes");
  assert.doesNotMatch(html, /undefined|NaN/, "no arithmetic leaking into the output");
});
