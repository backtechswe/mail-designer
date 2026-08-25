import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMergeValues, extractMergeFields, toHtml } from "../dist/render/index.js";
import { createBlock, createSection, emptyDocument, setIdFactory } from "../dist/document.js";

setIdFactory((() => { let n = 0; return () => `m${++n}`; })());
const set = (block, patch) => Object.assign(block, patch);

test("extractMergeFields finds tokens in text, headings, buttons and URLs", () => {
  const doc = emptyDocument();
  doc.settings.preheader = "Hej [Namn]";
  doc.blocks = [
    createSection([
      set(createBlock("heading"), { html: "Välkommen [Namn]" }),
      set(createBlock("text"), { html: "<p>Din ort är [Ort].</p>" }),
      // The token hiding in a URL is the one people forget they depend on.
      set(createBlock("button"), { label: "Boka i [Ort]", href: "https://x.se?id=[Kundnr]" }),
      set(createBlock("image"), { src: "https://x.se/[Bildnamn].png", alt: "Bild för [Namn]" }),
    ]),
  ];

  assert.deepEqual(extractMergeFields(doc), ["Namn", "Ort", "Kundnr", "Bildnamn"]);
});

test("extractMergeFields returns each token once, in document order", () => {
  const doc = emptyDocument();
  doc.blocks = [
    createSection([
      set(createBlock("text"), { html: "[B] [A] [B]" }),
      set(createBlock("text"), { html: "[A] [C]" }),
    ]),
  ];
  assert.deepEqual(extractMergeFields(doc), ["B", "A", "C"]);
});

test("applyMergeValues escapes values so a name cannot break the markup", () => {
  const out = applyMergeValues('<a title="[Namn]">[Namn]</a>', { Namn: 'Ben & "Jerry" <b>' });
  assert.equal(out, '<a title="Ben &amp; &quot;Jerry&quot; &lt;b&gt;">Ben &amp; &quot;Jerry&quot; &lt;b&gt;</a>');
  assert.doesNotMatch(out, /<b>/);
});

test("applyMergeValues leaves values alone in text mode", () => {
  assert.equal(applyMergeValues("Hej [Namn]", { Namn: "Ben & Co" }, { escape: "none" }), "Hej Ben & Co");
});

test("an unmatched token is kept by default and blanked on request", () => {
  assert.equal(applyMergeValues("Hej [Namn]!", { Ort: "Kalmar" }), "Hej [Namn]!");
  assert.equal(applyMergeValues("Hej [Namn]!", { Ort: "Kalmar" }, { onMissing: "blank" }), "Hej !");
  // No values at all behaves the same way, rather than throwing.
  assert.equal(applyMergeValues("Hej [Namn]!", undefined), "Hej [Namn]!");
  assert.equal(applyMergeValues("Hej [Namn]!", undefined, { onMissing: "blank" }), "Hej !");
});

test("token matching tolerates padding and case", () => {
  assert.equal(applyMergeValues("Hej [ Namn ]", { Namn: "Anna" }), "Hej Anna");
  assert.equal(applyMergeValues("Hej [namn]", { Namn: "Anna" }), "Hej Anna");
});

test("a bracket that is not a token is left alone", () => {
  const input = "Se [1] och [] och [ett väldigt långt värde som aldrig kan vara ett fältnamn eftersom det är för långt för gränsen på sextiofyra tecken]";
  assert.equal(applyMergeValues(input, { Namn: "Anna" }), input);
});

test("substitution happens in both the html and the text part of one render", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Hej [Namn]" })])];
  const { html, text } = toHtml(doc, { mergeValues: { Namn: "Anna & Co" } });
  assert.match(html, /Anna &amp; Co/);
  assert.equal(text, "Hej Anna & Co");
});
