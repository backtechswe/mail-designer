import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDataValues, extractDataFields, toHtml } from "../dist/render/index.js";
import { createBlock, createSection, emptyDocument, setIdFactory } from "../dist/document.js";
import { builtInPresets } from "../dist/presets/index.js";

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

/*
 * The renderer writes [Bracketed] runs of its own, and they used to be substitutable.
 *
 * `<!--[if mso]>` and `<![endif]-->` hold the Outlook ghost table together; `[data-ogsb]`
 * and `[data-ogsc]` are what Outlook.com keys its dark mode on. All four match DATA_TOKEN.
 * With onMissingField "keep" nothing happened, because an unmatched token is left alone —
 * so the bug was invisible until someone used "blank", which erased them and turned
 * `<!--[if mso]>` into `<!-->`. That is an abrupt-closing comment: every client ends the
 * comment there, the ghost table becomes live markup, and the layout doubles. Reported from
 * a .NET integration, not from here.
 */
const darkDoc = () => {
  const doc = emptyDocument();
  doc.settings.dark = { backgroundColor: "#1a1a1a", textColor: "#e0e0e0" };
  doc.settings.preheader = "Hi [Name]";
  doc.blocks = [createSection([set(createBlock("text"), { html: "Note: [Note]" })])];
  return doc;
};

test("the renderer's own brackets are not data fields", () => {
  for (const onMissingField of ["keep", "blank"]) {
    const { html } = toHtml(darkDoc(), { data: { Name: "Robin" }, onMissingField });
    for (const marker of ["[if mso]", "[endif]", "[data-ogsb]", "[data-ogsc]"]) {
      assert.ok(html.includes(marker), `${marker} was eaten with onMissingField: ${onMissingField}`);
    }
  }
});

test("substitution never changes the conditional-comment structure", () => {
  /*
   * Not "the output contains no `<!-->`": that string is legitimate on its own, as the
   * second half of `<!--[if !mso]><!-->`, the pattern that reveals content to everything
   * except Outlook. The real invariant is that the comment scaffolding a preset renders is
   * the same whether or not data was applied — substitution belongs to the copy, not to the
   * markup around it.
   */
  const scaffolding = (html) => (html.match(/<!--(?:\[[^\]]*\]>?|>|<!\[endif\]-->)/g) ?? []).join("|");
  for (const preset of builtInPresets) {
    const plain = scaffolding(toHtml(preset.document).html);
    for (const onMissingField of ["keep", "blank"]) {
      const applied = scaffolding(toHtml(preset.document, { data: {}, onMissingField }).html);
      assert.equal(applied, plain, `${preset.id} lost markup with onMissingField: ${onMissingField}`);
    }
  }
});

test("scoping substitution to the document's fields does not stop it substituting", () => {
  const doc = darkDoc();
  const filled = toHtml(doc, { data: { Name: "Robin", Note: "hello" }, onMissingField: "blank" });
  assert.ok(filled.html.includes("Robin"), "a declared field is still substituted");
  assert.ok(filled.html.includes("hello"));
  assert.ok(filled.text.includes("Robin"), "and in the text part too");

  const missing = toHtml(doc, { data: { Name: "Robin" }, onMissingField: "blank" });
  assert.ok(!missing.html.includes("[Note]"), "a declared field with no value still blanks");
  const kept = toHtml(doc, { data: { Name: "Robin" }, onMissingField: "keep" });
  assert.ok(kept.html.includes("[Note]"), "and is still kept in keep mode");
});

test("extractDataFields sees the URLs a token can hide in", () => {
  const doc = emptyDocument();
  doc.blocks = [
    set(createSection([set(createBlock("social"), {
      items: [{ network: "x", href: "https://x.se", iconUrl: "https://cdn.x.se/[Brand].png" }],
    })]), { backgroundUrl: "https://x.se/[Hero].jpg" }),
  ];
  const fields = extractDataFields(doc);
  // Both were invisible to the scan, so a host asking "which columns does this need?" was
  // told the wrong answer — and with substitution now scoped to that answer, they would
  // also have stopped being substituted at all.
  assert.ok(fields.includes("Hero"), "section backgroundUrl");
  assert.ok(fields.includes("Brand"), "social iconUrl");
});

/*
 * rawFields — markup allowed, not trust granted.
 *
 * Asked for as "let a field's value pass through unescaped". Built as "sanitise instead of
 * escape", because escaping is not the only thing standing between a data value and the
 * mail: sanitize() runs at *render* time, on html blocks, and substitution happens after it.
 * A genuinely raw value would therefore bypass the sanitiser entirely — the one place that
 * strips script tags, event handlers and executable URL schemes.
 */
test("a raw field may carry markup", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Rooms: [List]" })])];
  const { html } = toHtml(doc, {
    data: { List: '<b>Room A</b> and <i>Room B</i>' },
    rawFields: ["List"],
  });
  assert.match(html, /<b>Room A<\/b> and <i>Room B<\/i>/);
});

test("a raw field is still sanitised", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "By [Who]" })])];
  const { html } = toHtml(doc, {
    data: { Who: '<script>alert(1)</script><img src=x onerror=alert(1)><b>ok</b>' },
    rawFields: ["Who"],
  });
  assert.ok(!/<script/i.test(html), "script tag");
  assert.ok(!/onerror/i.test(html), "event handler");
  assert.match(html, /<b>ok<\/b>/, "and the legitimate markup survived");
});

test("escaping stays the default for every field not named", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "[A] [B]" })])];
  const { html } = toHtml(doc, {
    data: { A: "<b>raw</b>", B: "<b>escaped</b>" },
    rawFields: ["A"],
  });
  assert.match(html, /<b>raw<\/b>/);
  assert.match(html, /&lt;b&gt;escaped/);
});

test("the text alternative strips a raw field's tags rather than printing them", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Rooms: [List]" })])];
  const { text } = toHtml(doc, { data: { List: "<b>Room A</b>" }, rawFields: ["List"] });
  assert.ok(text.includes("Room A"));
  assert.ok(!text.includes("<b>"), "text has no markup to allow");
});
