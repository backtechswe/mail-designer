/**
 * The highlighter writes markup into the page, so escaping is the whole test suite. Anything
 * that gets through unescaped is an injection from a document that may have come from a
 * database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, highlightHtml, highlightJson } from "../dist/editor/highlight.js";

/** The visible text, with the highlighter's own spans removed. */
const plain = (html) =>
  html
    .replace(/<span class="md-hl-[a-z]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

test("nothing survives unescaped", () => {
  const nasty = '<img src=x onerror="alert(1)">';
  const out = highlightHtml(nasty);
  assert.ok(!out.includes("<img"), "the tag itself must be escaped");
  assert.ok(!out.includes('onerror="alert(1)"'), "and so must the attribute");
  assert.match(out, /&lt;/);
});

test("highlighting is lossless: the visible text is the source", () => {
  const cases = [
    '<table role="presentation" width="600"><tr><td>Hej</td></tr></table>',
    "<!--[if mso]><table><tr><td><![endif]-->",
    "<!DOCTYPE html>",
    "text with < and > and & in it",
    "<p>Ampersand &amp; entity</p>",
    "",
    "<broken",
    "<!-- unterminated comment",
  ];
  for (const source of cases) assert.equal(plain(highlightHtml(source)), source, source);
});

test("an MSO conditional is a comment, not a tag", () => {
  const out = highlightHtml("<!--[if mso]><table><![endif]-->");
  assert.match(out, /<span class="md-hl-comment">/);
  // One comment span, not a tag span for the table inside it.
  assert.equal((out.match(/md-hl-tag/g) ?? []).length, 0);
});

test("tags, attributes and values are told apart", () => {
  const out = highlightHtml('<td bgcolor="#ffffff" width=600>x</td>');
  assert.match(out, /<span class="md-hl-tag">td<\/span>/);
  assert.match(out, /<span class="md-hl-attr">bgcolor<\/span>/);
  assert.match(out, /<span class="md-hl-value">&quot;#ffffff&quot;<\/span>|md-hl-value">"#ffffff"/);
  assert.match(out, /<span class="md-hl-attr">width<\/span>/);
});

test("a style attribute full of colons and semicolons stays one value", () => {
  const out = highlightHtml('<td style="padding:0;mso-line-height-rule:exactly">x</td>');
  assert.equal((out.match(/md-hl-value/g) ?? []).length, 1);
  assert.equal(plain(out), '<td style="padding:0;mso-line-height-rule:exactly">x</td>');
});

test("JSON keys, strings, numbers and literals are told apart", () => {
  const out = highlightJson('{"width": 640, "fullWidth": true, "name": "Hej", "x": null}');
  assert.match(out, /<span class="md-hl-key">"width"<\/span>/);
  assert.match(out, /<span class="md-hl-number">640<\/span>/);
  assert.match(out, /<span class="md-hl-literal">true<\/span>/);
  assert.match(out, /<span class="md-hl-literal">null<\/span>/);
  assert.match(out, /<span class="md-hl-value">"Hej"<\/span>/);
});

test("JSON highlighting is lossless, including markup inside strings", () => {
  const source = JSON.stringify({ html: '<p>Hej <b>&amp; hej</b></p>', n: -1.5e3 }, null, 2);
  assert.equal(plain(highlightJson(source)), source);
  assert.ok(!highlightJson(source).includes("<p>"), "markup in a string stays escaped");
});

test("a colon inside a string does not make the next string a key", () => {
  const out = highlightJson('{"href": "https://example.com/x"}');
  assert.equal((out.match(/md-hl-key/g) ?? []).length, 1);
});

test("escapeHtml handles the three that matter and leaves the rest alone", () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=\"x\"&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml("åäö 🙂"), "åäö 🙂");
});
