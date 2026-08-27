import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDataValues, extractDataFields, toHtml } from "../dist/render/index.js";
import { createBlock, createSection, emptyDocument, setIdFactory } from "../dist/document.js";

setIdFactory((() => { let n = 0; return () => `m${++n}`; })());
const set = (block, patch) => Object.assign(block, patch);

test("extractDataFields finds tokens in text, headings, buttons and URLs", () => {
  const doc = emptyDocument();
  doc.settings.preheader = "Hi [Name]";
  doc.blocks = [
    createSection([
      set(createBlock("heading"), { html: "Welcome [Name]" }),
      set(createBlock("text"), { html: "<p>Your city is [City].</p>" }),
      // The token hiding in a URL is the one people forget they depend on.
      set(createBlock("button"), { label: "Book in [City]", href: "https://x.se?id=[CustomerNo]" }),
      set(createBlock("image"), { src: "https://x.se/[ImageName].png", alt: "Image for [Name]" }),
    ]),
  ];

  assert.deepEqual(extractDataFields(doc), ["Name", "City", "CustomerNo", "ImageName"]);
});

test("extractDataFields returns each token once, in document order", () => {
  const doc = emptyDocument();
  doc.blocks = [
    createSection([
      set(createBlock("text"), { html: "[B] [A] [B]" }),
      set(createBlock("text"), { html: "[A] [C]" }),
    ]),
  ];
  assert.deepEqual(extractDataFields(doc), ["B", "A", "C"]);
});

test("applyDataValues escapes values so a name cannot break the markup", () => {
  const out = applyDataValues('<a title="[Name]">[Name]</a>', { Name: 'Ben & "Jerry" <b>' });
  assert.equal(out, '<a title="Ben &amp; &quot;Jerry&quot; &lt;b&gt;">Ben &amp; &quot;Jerry&quot; &lt;b&gt;</a>');
  assert.doesNotMatch(out, /<b>/);
});

test("applyDataValues leaves values alone in text mode", () => {
  assert.equal(applyDataValues("Hi [Name]", { Name: "Ben & Co" }, { escape: "none" }), "Hi Ben & Co");
});

test("an unmatched token is kept by default and blanked on request", () => {
  assert.equal(applyDataValues("Hi [Name]!", { City: "Kalmar" }), "Hi [Name]!");
  assert.equal(applyDataValues("Hi [Name]!", { City: "Kalmar" }, { onMissing: "blank" }), "Hi !");
  // No values at all behaves the same way, rather than throwing.
  assert.equal(applyDataValues("Hi [Name]!", undefined), "Hi [Name]!");
  assert.equal(applyDataValues("Hi [Name]!", undefined, { onMissing: "blank" }), "Hi !");
});

test("token matching tolerates padding and case", () => {
  assert.equal(applyDataValues("Hi [ Name ]", { Name: "Anna" }), "Hi Anna");
  assert.equal(applyDataValues("Hi [name]", { Name: "Anna" }), "Hi Anna");
});

test("a bracket that is not a token is left alone", () => {
  const input = "See [1] and [] and [a very long value that can never be a field name because it is longer than the sixty-four character limit]";
  assert.equal(applyDataValues(input, { Name: "Anna" }), input);
});

test("substitution happens in both the html and the text part of one render", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Hi [Name]" })])];
  const { html, text } = toHtml(doc, { data: { Name: "Anna & Co" } });
  assert.match(html, /Anna &amp; Co/);
  assert.equal(text, "Hi Anna & Co");
});
