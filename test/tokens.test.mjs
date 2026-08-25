/**
 * The pill transformation. It sits between the document and the DOM, so a leak in either
 * direction is a real bug: editor chrome in a sent email, or a lost token in the document.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decorateTokens, pill, stripTokens } from "../dist/data/tokens.js";

const round = (html) => stripTokens(decorateTokens(html));

test("a token in text becomes a pill carrying the original", () => {
  const out = decorateTokens("Hej [Namn]!");
  assert.match(out, /<span class="md-token" data-md-token="\[Namn\]" contenteditable="false">Namn<\/span>/);
  assert.match(out, /^Hej /);
  assert.match(out, /!$/);
});

test("the pill shows the field's name, not the brackets", () => {
  assert.equal(pill("[Ort]").includes(">Ort<"), true);
  assert.equal(pill("[Ort]").includes(">[Ort]<"), false);
});

test("decorating and stripping is lossless", () => {
  const cases = [
    "Hej [Namn]!",
    "<p>Hej <strong>[Namn]</strong>, välkommen till [Ort].</p>",
    "[A][B][C]",
    "Inga fält alls",
    "",
    "<p>Hakparentes utan fält: [ och ]</p>",
    "<p>Radbrytning<br>[Datum]</p>",
  ];
  for (const html of cases) assert.equal(round(html), html, html);
});

test("tokens inside tags are left alone", () => {
  // A real token the renderer will substitute — but it is not text on the page, and wrapping
  // it in markup would corrupt the attribute.
  const html = '<a href="https://example.com/?id=[Id]">Läs mer</a>';
  assert.equal(decorateTokens(html), html);
  assert.equal(round(html), html);
});

test("a token whose name needs escaping survives the round trip", () => {
  const html = 'Hej [Namn & "Co"]!';
  assert.equal(round(html), html);
  assert.ok(!decorateTokens(html).includes('data-md-token="[Namn & "'), "attribute is escaped");
});

test("stripping tolerates what a browser may have done to the span", () => {
  // Browsers reorder attributes, add styles on paste, and rewrite the inner text.
  const mangled =
    '<span style="color:red" data-md-token="[Namn]" class="md-token" contenteditable="false">' +
    "<b>whatever</b></span>";
  assert.equal(stripTokens(mangled), "[Namn]");
});

test("stripping is a no-op on document HTML, which never holds pills", () => {
  const html = "<p>Hej <em>[Namn]</em></p>";
  assert.equal(stripTokens(html), html);
});

test("several pills in one string are all restored", () => {
  const html = "<p>[A] och [B] och [C]</p>";
  const decorated = decorateTokens(html);
  assert.equal((decorated.match(/class="md-token"/g) ?? []).length, 3);
  assert.equal(stripTokens(decorated), html);
});

test("decorating is idempotent in effect: pills do not nest", () => {
  const once = decorateTokens("Hej [Namn]");
  // The token now lives in an attribute, and attributes are inside a tag — so a second pass
  // finds nothing to wrap.
  assert.equal(decorateTokens(once), once);
});

test("a span nested inside a pill does not leave a stray closing tag", () => {
  // What a colour command across a selection containing a pill can produce.
  const mangled =
    '<p>Hej <span class="md-token" data-md-token="[Namn]" contenteditable="false">' +
    '<span style="color:#f00">Namn</span></span>!</p>';
  assert.equal(stripTokens(mangled), "<p>Hej [Namn]!</p>");
});

test("several nested pills in one string all close correctly", () => {
  const one = '<span data-md-token="[A]"><span>A</span></span>';
  const two = '<span data-md-token="[B]">B</span>';
  assert.equal(stripTokens(`<p>${one} och ${two}</p>`), "<p>[A] och [B]</p>");
});

test("an unclosed pill consumes the rest rather than corrupting the document", () => {
  // Not expected to happen; the point is that it fails predictably.
  assert.equal(stripTokens('start <span data-md-token="[X]">X'), "start [X]");
});
