/**
 * Spacing is [top, right, bottom, left] — in TypeScript. A document is JSON.
 *
 * Reported from a .NET integration: a document holding `innerPadding: { top, right, bottom,
 * left }` passed validateDocument as ok and then threw `value.map is not a function` inside
 * the renderer. docs/backend-dotnet.md tells hosts to store the document opaquely and check
 * it here, which makes validateDocument the only gate a document passes before it is sent —
 * so approving one that cannot be rendered is worse than not checking at all.
 *
 * The split these tests pin down: validation rejects what cannot be read as spacing,
 * coerceDocument repairs what can, and the renderer emits valid CSS either way.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceDocument, validateDocument } from "../dist/index.js";
import { toHtml } from "../dist/render/index.js";
import { toSpacing } from "../dist/render/values.js";

const withPadding = (innerPadding) => ({
  version: 1,
  settings: {
    width: 600, backgroundColor: "#fff", contentBackgroundColor: "#fff",
    fontFamily: "sans-serif", fontSize: 14, lineHeight: 1.6,
    textColor: "#000", linkColor: "#1677ff",
  },
  blocks: [{
    id: "s1", type: "section", children: [{
      id: "b1", type: "button", label: "Cancel", href: "https://example.com",
      backgroundColor: "#f00", textColor: "#fff", borderRadius: 6, fontSize: 14,
      align: "center", innerPadding,
    }],
  }],
});

const buttonPadding = (doc) =>
  toHtml(doc).html.match(/<a [^>]*display:inline-block[^>]*>/)?.[0].match(/padding:([^;"]*)/)?.[1];

// Different ways of writing the same thing. All of these are what a person or an agent
// writes by hand, so they are repaired rather than refused.
const EQUIVALENT = [
  ["the tuple itself", [12, 24, 12, 24]],
  ["the object form", { top: 12, right: 24, bottom: 12, left: 24 }],
  ["a CSS shorthand string", "12px 24px"],
  ["two-value shorthand", [12, 24]],
  ["numbers as strings", ["12", "24", "12", "24"]],
];

for (const [name, value] of EQUIVALENT) {
  test(`${name} validates, and renders to the same padding`, () => {
    assert.equal(validateDocument(withPadding(value)).ok, true);
    assert.equal(buttonPadding(coerceDocument(withPadding(value))), "12px 24px 12px 24px");
  });
}

// Values with no reading at all. Refused — guessing which number was meant would be worse.
const UNREADABLE = [
  ["not a number", [Number.NaN, 0, 0, 0]],
  ["infinite", [Number.POSITIVE_INFINITY, 0, 0, 0]],
  ["half an object", { top: 12, right: 24 }],
  ["prose", "abc"],
  ["five values", [1, 2, 3, 4, 5]],
  ["nothing at all", {}],
];

for (const [name, value] of UNREADABLE) {
  test(`${name} is reported rather than approved`, () => {
    const result = validateDocument(withPadding(value));
    assert.equal(result.ok, false, "validateDocument said ok");
    assert.match(result.issues[0].path, /innerPadding$/);
  });
}

test("the renderer stays valid CSS even when nobody validated", () => {
  // A host that skips validateDocument still must not send `padding:NaNpx` to an inbox,
  // and must not crash on a shape the type system said could not exist.
  for (const [, value] of [...EQUIVALENT, ...UNREADABLE]) {
    const padding = buttonPadding(coerceDocument(withPadding(value)));
    assert.match(padding, /^(\d+px ){3}\d+px$/, `emitted ${padding}`);
  }
});

test("shorthand expands the way CSS does", () => {
  assert.deepEqual(toSpacing([12]), [12, 12, 12, 12]);
  assert.deepEqual(toSpacing([12, 24]), [12, 24, 12, 24]);
  assert.deepEqual(toSpacing([12, 24, 36]), [12, 24, 36, 24]);
  assert.deepEqual(toSpacing("8px"), [8, 8, 8, 8]);
  assert.equal(toSpacing(undefined), null);
});
