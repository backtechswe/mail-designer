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
    { ...createBlock("text"), html: "<p>Read on</p>" },
    { ...createBlock("heading"), html: "Report of the month" },
    { ...createBlock("heading"), html: "Underrubrik" },
  ]);
  assert.equal(messageSummary(doc).subject, "Report of the month");
});

test("no heading means no subject, and the caller decides what to show", () => {
  const doc = docWith([{ ...createBlock("text"), html: "<p>Bara text</p>" }]);
  assert.equal(messageSummary(doc).subject, "");
});

test("the preheader is the snippet when it is set", () => {
  let doc = docWith([{ ...createBlock("text"), html: "<p>Body text</p>" }]);
  doc = updateSettings(doc, { preheader: "Three things we learned" });
  const summary = messageSummary(doc);
  assert.equal(summary.snippet, "Three things we learned");
  assert.equal(summary.snippetIsFallback, false);
});

test("without a preheader the snippet falls back to body text, and says so", () => {
  const doc = docWith([
    { ...createBlock("text"), html: '<p>View this email in your <a href="#">browser</a></p>' },
  ]);
  const summary = messageSummary(doc);
  // Exactly the failure the fallback exists to expose: the browser link as the inbox teaser.
  assert.equal(summary.snippet, "View this email in your browser");
  assert.equal(summary.snippetIsFallback, true);
});

test("snippet text is stripped of markup and entities, and collapsed", () => {
  const doc = docWith([
    { ...createBlock("text"), html: "<p>One  &amp;  <strong>two</strong><br>three</p>" },
  ]);
  assert.equal(messageSummary(doc).snippet, "One & two three");
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

/* ------------------------------------------------------- image compression, headless */

import { compressImage, formatBytes } from "../dist/editor/compress.js";

test("compression is a no-op outside a browser rather than a crash", async () => {
  // The renderer entry is used on servers; the editor entry must at least not throw there.
  const file = { size: 5_000_000, type: "image/jpeg", name: "x.jpg", lastModified: 0 };
  const result = await compressImage(file);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "unsupported");
  assert.equal(result.file, file, "the original is handed back untouched");
});

test("formats that a canvas would destroy are passed through", async () => {
  for (const type of ["image/gif", "image/svg+xml", "image/avif", "application/pdf"]) {
    const result = await compressImage({ size: 5_000_000, type, name: "x", lastModified: 0 });
    assert.equal(result.changed, false, type);
  }
});

test("a file already small enough is left alone", async () => {
  const result = await compressImage({ size: 12_000, type: "image/jpeg", name: "x.jpg", lastModified: 0 });
  assert.equal(result.reason, "smaller-already");
});

test("formatBytes says something a person can read", () => {
  assert.equal(formatBytes(900), "900 B");
  assert.equal(formatBytes(180_000), "176 kB");
  assert.equal(formatBytes(3_558_842), "3.4 MB");
});
