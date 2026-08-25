import test from "node:test";
import assert from "node:assert/strict";
import { messageSummary } from "../dist/editor/message.js";
import { DEVICES, fitScale, frameSize } from "../dist/editor/devices.js";
import { emptyDocument, createBlock, insertBlock, updateSettings } from "../dist/document.js";

/** A one-section document holding exactly these leaves, and nothing the factory added. */
function docWith(blocks) {
  let doc = emptyDocument();
  const section = doc.blocks[0];
  const container = { kind: "section", id: section.id };
  doc = { ...doc, blocks: [{ ...section, children: [] }] };
  blocks.forEach((block, index) => {
    doc = insertBlock(doc, block, { container, index });
  });
  return doc;
}

test("subject comes from the first heading", () => {
  const doc = docWith([
    { ...createBlock("text"), html: "<p>Läs vidare</p>" },
    { ...createBlock("heading"), html: "Månadens rapport" },
    { ...createBlock("heading"), html: "Underrubrik" },
  ]);
  assert.equal(messageSummary(doc).subject, "Månadens rapport");
});

test("no heading means no subject, and the caller decides what to show", () => {
  const doc = docWith([{ ...createBlock("text"), html: "<p>Bara text</p>" }]);
  assert.equal(messageSummary(doc).subject, "");
});

test("the preheader is the snippet when it is set", () => {
  let doc = docWith([{ ...createBlock("text"), html: "<p>Brödtext</p>" }]);
  doc = updateSettings(doc, { preheader: "Tre saker vi lärde oss" });
  const summary = messageSummary(doc);
  assert.equal(summary.snippet, "Tre saker vi lärde oss");
  assert.equal(summary.snippetIsFallback, false);
});

test("without a preheader the snippet falls back to body text, and says so", () => {
  const doc = docWith([
    { ...createBlock("text"), html: '<p>Visa detta mejl i <a href="#">webbläsaren</a></p>' },
  ]);
  const summary = messageSummary(doc);
  // Exactly the failure the fallback exists to expose: the browser link as the inbox teaser.
  assert.equal(summary.snippet, "Visa detta mejl i webbläsaren");
  assert.equal(summary.snippetIsFallback, true);
});

test("snippet text is stripped of markup and entities, and collapsed", () => {
  const doc = docWith([
    { ...createBlock("text"), html: "<p>Ett  &amp;  <strong>två</strong><br>tre</p>" },
  ]);
  assert.equal(messageSummary(doc).snippet, "Ett & två tre");
});

test("a document with nothing in it summarises to nothing rather than throwing", () => {
  assert.deepEqual(messageSummary(docWith([])), {
    subject: "",
    snippet: "",
    snippetIsFallback: false,
  });
});

test("a brand new document shows its placeholder as the fallback snippet", () => {
  // Not a special case worth coding around: a new mail really would arrive looking like this,
  // and the mock saying so out loud is the useful part.
  const summary = messageSummary(emptyDocument());
  assert.equal(summary.subject, "");
  assert.equal(summary.snippetIsFallback, true);
  assert.ok(summary.snippet.length > 0);
});

test("the frame is the screen plus two bezels", () => {
  for (const viewport of ["desktop", "tablet", "phone"]) {
    const { screen, bezel } = DEVICES[viewport];
    assert.deepEqual(frameSize(viewport), {
      width: screen.width + bezel * 2,
      height: screen.height + bezel * 2,
    });
  }
});

test("the mail never renders wider than the screen it is on", () => {
  for (const viewport of ["desktop", "tablet", "phone"]) {
    const device = DEVICES[viewport];
    assert.ok(
      device.content <= device.screen.width,
      `${viewport}: content ${device.content} exceeds screen ${device.screen.width}`,
    );
  }
});

test("fitScale shrinks to fit but never scales past 1:1", () => {
  const size = frameSize("phone");
  assert.equal(fitScale("phone", { width: size.width * 3, height: size.height * 3 }), 1);
  assert.equal(fitScale("phone", { width: size.width, height: size.height / 2 }), 0.5);
  assert.equal(fitScale("phone", { width: size.width / 4, height: size.height }), 0.25);
});

test("fitScale survives being measured before layout", () => {
  assert.equal(fitScale("tablet", { width: 0, height: 0 }), 1);
  assert.equal(fitScale("tablet", { width: -8, height: -8 }), 1);
});
