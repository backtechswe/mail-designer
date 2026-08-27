/**
 * The inbox checks. Every one of these looks fine in a browser preview and then goes wrong
 * in a real client, which is exactly why they need naming rather than eyeballing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GMAIL_CLIP_BYTES, emailSize, inspectEmail, toHtml } from "../dist/render/index.js";
import { createBlock, createSection, emptyDocument, setIdFactory } from "../dist/document.js";

setIdFactory((() => { let n = 0; return () => `i${++n}`; })());
const set = (block, patch) => Object.assign(block, patch);
const ids = (warnings, id) => warnings.find((w) => w.id === id);

function check(doc) {
  return inspectEmail(doc, toHtml(doc));
}

test("a clean mail with a preheader raises nothing but the expected nudges", () => {
  const doc = emptyDocument();
  doc.settings.preheader = "Kort förhandsvisning";
  doc.blocks = [createSection([set(createBlock("text"), { html: "Hi." })])];
  const w = check(doc);
  assert.equal(ids(w, "gmail-clipping"), undefined);
  assert.equal(ids(w, "no-preheader"), undefined);
  assert.equal(ids(w, "no-plain-text"), undefined);
});

test("a missing preheader is flagged, because the inbox will show body copy instead", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Hi." })])];
  assert.equal(ids(check(doc), "no-preheader").level, "warning");
});

test("Gmail clipping is an error, with the numbers to act on", () => {
  const doc = emptyDocument();
  doc.settings.preheader = "x";
  // Enough text to pass 102 KB of rendered HTML.
  const filler = "Lorem ipsum dolor sit amet. ".repeat(200);
  doc.blocks = [
    createSection(
      Array.from({ length: 30 }, () => set(createBlock("text"), { html: `<p>${filler}</p>` })),
    ),
  ];
  const w = ids(check(doc), "gmail-clipping");
  assert.equal(w.level, "error", "everything past the cut is hidden behind a link most people never click");
  assert.ok(w.detail.bytes > GMAIL_CLIP_BYTES);
  assert.equal(w.detail.limit, GMAIL_CLIP_BYTES);
});

test("a data: URI image is an error — Gmail refuses to load it at all", () => {
  const doc = emptyDocument();
  const img = set(createBlock("image"), {
    src: "data:image/png;base64,iVBORw0KGgo=",
    alt: "Logotyp",
  });
  doc.blocks = [createSection([img])];
  const w = ids(check(doc), "data-uri-image");
  assert.equal(w.level, "error");
  assert.deepEqual(w.blocks, [img.id]);
});

test("an image with no alt text is flagged, since images are blocked by default", () => {
  const doc = emptyDocument();
  const img = set(createBlock("image"), { src: "https://x.se/a.png", alt: "  " });
  doc.blocks = [createSection([img])];
  assert.deepEqual(ids(check(doc), "missing-alt").blocks, [img.id]);

  const withAlt = emptyDocument();
  withAlt.blocks = [
    createSection([set(createBlock("image"), { src: "https://x.se/a.png", alt: "En bild" })]),
  ];
  assert.equal(ids(check(withAlt), "missing-alt"), undefined);
});

test("an empty image block is not nagged about alt text it does not need", () => {
  const doc = emptyDocument();
  doc.blocks = [createSection([createBlock("image")])];
  assert.equal(ids(check(doc), "missing-alt"), undefined);
});

test("a section background image is flagged — Outlook needs VML we do not emit", () => {
  const doc = emptyDocument();
  const section = set(createSection([createBlock("text")]), {
    backgroundUrl: "https://x.se/bg.jpg",
  });
  doc.blocks = [section];
  const w = ids(check(doc), "background-image");
  assert.equal(w.level, "warning");
  assert.deepEqual(w.blocks, [section.id]);
});

test("content wider than 640px is flagged", () => {
  const doc = emptyDocument();
  doc.settings.width = 720;
  assert.equal(ids(check(doc), "wide-content").detail.width, 720);

  doc.settings.width = 600;
  assert.equal(ids(check(doc), "wide-content"), undefined);
});

test("emailSize counts bytes, not characters", () => {
  assert.equal(emailSize("abc"), 3);
  assert.equal(emailSize("åäö"), 6, "Swedish characters are two bytes each in UTF-8");
});
