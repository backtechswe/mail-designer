/**
 * hideWhenEmpty — the one thing a transactional template needs that the document model had
 * no way to say.
 *
 * Without it, optional content has to be expressed by moving the label inside the value: a
 * `[Note]` the host sets to either "" or "Note: …". That leaves the block behind whatever
 * happens, so an absent value still renders its padding, and the label stops being something
 * the designer can edit.
 *
 * The definition that makes it useful: "empty" is about the *fields* a block refers to, not
 * the text it renders. `Note: [Note]` renders as "Note: " with no value, which is not blank —
 * and that leftover label is exactly what this removes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { toHtml } from "../dist/render/index.js";

const doc = (blocks) => ({
  version: 1,
  settings: {
    width: 600, backgroundColor: "#fff", contentBackgroundColor: "#fff",
    fontFamily: "sans-serif", fontSize: 14, lineHeight: 1.6,
    textColor: "#000", linkColor: "#1677ff",
  },
  blocks,
});
const text = (id, html, extra = {}) => ({ id, type: "text", html, align: "left", ...extra });
const section = (id, children, extra = {}) => ({ id, type: "section", children, ...extra });

const conditional = doc([
  section("s1", [
    text("a", "Always"),
    text("b", "Note: [Note]", { hideWhenEmpty: true }),
  ]),
]);

test("a conditional block goes when its field has no value", () => {
  const { html } = toHtml(conditional, { data: {} });
  assert.ok(html.includes("Always"));
  assert.ok(!html.includes("Note:"), "the label went with the block");
});

test("and stays when it has one", () => {
  const { html } = toHtml(conditional, { data: { Note: "careful" } });
  assert.ok(html.includes("Note:"));
  assert.ok(html.includes("careful"));
});

test("whitespace is not a value", () => {
  const { html } = toHtml(conditional, { data: { Note: "   " } });
  assert.ok(!html.includes("Note:"));
});

test("the plain-text alternative agrees with the html", () => {
  // Both are produced from the same pruned document. If they disagreed, a client showing the
  // text part would describe a different email than the one that was designed.
  for (const data of [{}, { Note: "x" }]) {
    const { html, text: plain } = toHtml(conditional, { data });
    assert.equal(plain.includes("Note:"), html.includes("Note:"));
  }
});

test("a block referring to no field is never dropped", () => {
  // There is nothing for it to be conditional on, and silently removing it would be a
  // surprise rather than a feature.
  const { html } = toHtml(doc([section("s1", [text("a", "Fixed copy", { hideWhenEmpty: true })])]), {
    data: {},
  });
  assert.ok(html.includes("Fixed copy"));
});

test("a section goes when everything inside it went", () => {
  const nested = doc([
    section("s1", [text("a", "[One]", { hideWhenEmpty: true }), text("b", "[Two]", { hideWhenEmpty: true })], {
      hideWhenEmpty: true,
      backgroundColor: "#eef2ff",
    }),
    section("s2", [text("c", "Kept")]),
  ]);
  const empty = toHtml(nested, { data: {} }).html;
  assert.ok(!empty.includes("#eef2ff"), "the section's own styling went too");
  assert.ok(empty.includes("Kept"));

  const partial = toHtml(nested, { data: { Two: "here" } }).html;
  assert.ok(partial.includes("#eef2ff"), "one surviving child keeps the section");
  assert.ok(partial.includes("here"));
});

test("a block with several fields survives on any one of them", () => {
  // Dropping it because one of two was missing would lose the value that was present.
  const both = doc([section("s1", [text("a", "Booking [Ref] scheduled [Date]", { hideWhenEmpty: true })])]);
  assert.ok(toHtml(both, { data: { Ref: "A-1" } }).html.includes("A-1"), "kept for the one that had a value");
  assert.ok(toHtml(both, { data: { Ref: "A-1" } }).html.includes("Booking"));
  assert.ok(!toHtml(both, { data: {} }).html.includes("Booking"), "dropped when neither had one");
});

test("a document with no conditional block is returned untouched", () => {
  const plain = doc([section("s1", [text("a", "Hello [Name]")])]);
  assert.equal(toHtml(plain, { data: { Name: "Robin" } }).html, toHtml(plain, { data: { Name: "Robin" } }).html);
  assert.ok(toHtml(plain, { data: {} }).html.includes("Hello"));
});
