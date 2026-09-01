import { test } from "node:test";
import assert from "node:assert/strict";
// Straight from the module: these are internals, and the public entry deliberately exposes
// only the two named forms. See src/render/index.ts.
import { sanitizeInline, sanitizeBlock, stripTags } from "../dist/render/sanitize.js";

test("script, style and iframe are removed with their contents", () => {
  assert.equal(sanitizeBlock("a<script>alert(1)</script>b"), "ab");
  assert.equal(sanitizeBlock("a<style>body{}</style>b"), "ab");
  assert.equal(sanitizeBlock('a<iframe src="x"></iframe>b'), "ab");
  // An unclosed opener must not survive by escaping the paired pattern.
  assert.equal(sanitizeBlock("a<script src=x>b"), "ab");
});

test("event handlers are stripped even on allowed tags and attributes", () => {
  assert.equal(sanitizeInline('<a href="https://x.se" onclick="evil()">x</a>'), '<a href="https://x.se">x</a>');
  assert.equal(sanitizeInline('<span onmouseover="evil()">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<b ONLOAD="evil()">x</b>'), "<b>x</b>");
});

test("executable URL schemes are dropped from href and src", () => {
  assert.equal(sanitizeInline('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeInline('<a href="JavaScript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeInline('<a href=" vbscript:x">y</a>'), "<a>y</a>");
  assert.equal(sanitizeBlock('<img src="javascript:alert(1)" />'), "<img />");
});

test("the old IE style-attribute vectors are dropped", () => {
  assert.equal(sanitizeInline('<span style="width:expression(alert(1))">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<span style="background:url(javascript:alert(1))">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<span style="color:red">x</span>'), '<span style="color:red">x</span>');
});

test("unknown tags go but their text stays", () => {
  assert.equal(sanitizeInline("<marquee>Hi</marquee>"), "Hi");
  assert.equal(sanitizeInline("<div>Hi</div>"), "Hi", "div is not inline-allowed");
  assert.equal(sanitizeBlock("<div>Hi</div>"), "<div>Hi</div>", "but it is allowed in a raw block");
});

test("permitted formatting survives untouched", () => {
  const input = '<p style="color:red"><b>bold</b> <i>italic</i><br /><a href="https://x.se" target="_blank">link</a></p>';
  assert.equal(sanitizeInline(input), input);
});

test("comments are removed, including MSO ones an author pasted in", () => {
  assert.equal(sanitizeBlock("a<!--[if mso]>x<![endif]-->b"), "ab");
});

test("attributes not on the whitelist are dropped", () => {
  assert.equal(sanitizeBlock('<td width="50%" bogus="1">x</td>'), '<td width="50%">x</td>');
});

test("stripTags turns markup into readable text", () => {
  assert.equal(stripTags("<p>One</p><p>Two</p>"), "One\nTwo");
  assert.equal(stripTags("Rad<br />Rad2"), "Rad\nRad2");
  assert.equal(stripTags("<ul><li>A</li><li>B</li></ul>"), "A\nB");
  assert.equal(stripTags("Tre&nbsp;ord &amp; mer"), "Tre ord & mer");
  assert.equal(stripTags("<script>evil()</script>Text"), "Text");
});

/* --------------------------------------------------- the style attribute, declaration by
                                                        declaration */

test("a style attribute keeps every declaration it came with", () => {
  // The semicolon is the attribute's structure. Cleaning the attribute as if it were a single
  // value deleted the separators, and `font-size:32px;font-weight:700` arrived in the mail as
  // `font-size:32pxfont-weight:700` — one invalid declaration where there had been two valid
  // ones, so the heading got neither its size nor its weight, and nothing said so.
  assert.equal(
    sanitizeInline('<span style="font-size:32px;font-weight:700">x</span>'),
    '<span style="font-size:32px;font-weight:700">x</span>',
  );
  assert.equal(
    sanitizeBlock('<td style="padding:0 12px;text-align:center;color:#333">x</td>'),
    '<td style="padding:0 12px;text-align:center;color:#333">x</td>',
  );
});

test("whitespace and a trailing semicolon are tidied, not treated as declarations", () => {
  assert.equal(
    sanitizeInline('<span style=" color : red ; font-weight : 700 ; ">x</span>'),
    '<span style="color:red;font-weight:700">x</span>',
  );
});

test("one bad declaration costs only itself", () => {
  // Before, a single hostile declaration took the whole attribute with it — which is the
  // safe direction, but it means an author loses formatting they cannot see a reason for.
  assert.equal(
    sanitizeInline('<span style="color:red;width:expression(alert(1));font-weight:700">x</span>'),
    '<span style="color:red;font-weight:700">x</span>',
  );
  // A fragment that is not a declaration at all is not one after the split either.
  assert.equal(sanitizeInline('<span style="color:red;garbage">x</span>'), '<span style="color:red">x</span>');
});

test("no declaration in author markup may fetch a remote resource", () => {
  // `<span style="background:url(http://tracker/x)">` is a tracking pixel: invisible in the
  // editor, invisible in the mail, and fetched by the recipient's client on open — in the
  // tenant's name, chosen by nobody in the tenant. A section background image is a declared
  // document field that the editor shows and inspectEmail warns about; this is not that.
  assert.equal(
    sanitizeBlock('<span style="background:url(http://tracker/x)">x</span>'),
    "<span>x</span>",
  );
  assert.equal(
    sanitizeBlock('<div style="color:#333;background-image:url(\'https://tracker/y.gif\')">x</div>'),
    '<div style="color:#333">x</div>',
  );
  assert.equal(
    sanitizeBlock('<div style="background:URL( //tracker/z )">x</div>'),
    "<div>x</div>",
  );
});

test("a semicolon smuggled in as an entity cannot become a separator", () => {
  // A browser decodes entities in an attribute before it parses the CSS, so `&#59;` would be
  // a live separator if it reached the output as one. Escaping the ampersand is what stops it.
  const out = sanitizeInline('<span style="color:red&#59;background:url(http://tracker/x)">x</span>');
  assert.doesNotMatch(out, /tracker/);
});
