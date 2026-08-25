/**
 * Invariants that must hold for *any* document. These guard the client workarounds that a
 * golden diff makes easy to skim past.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toHtml, computeWidths } from "../dist/render/index.js";
import { emptyDocument, createSection, createBlock, setIdFactory } from "../dist/document.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures");
const docs = readdirSync(fixtureDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => [f, JSON.parse(readFileSync(join(fixtureDir, f), "utf8"))]);

const set = (block, patch) => Object.assign(block, patch);

for (const [name, doc] of docs) {
  test(`${name}: emits the XHTML doctype email clients expect`, () => {
    const { html } = toHtml(doc);
    assert.match(html, /^<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD XHTML 1\.0 Transitional/);
  });

  test(`${name}: MSO conditional comments are balanced`, () => {
    const { html } = toHtml(doc);
    // Downlevel-hidden blocks: <!--[if mso]> ... <![endif]-->
    const opens = (html.match(/<!--\[if (!?)mso\]>/g) ?? []).length;
    const closes = (html.match(/<!\[endif\]-->/g) ?? []).length;
    assert.equal(opens, closes, "every [if mso] needs an [endif]");
  });

  test(`${name}: the Outlook DPI fix is present`, () => {
    const { html } = toHtml(doc);
    assert.match(html, /<o:PixelsPerInch>96<\/o:PixelsPerInch>/);
  });

  test(`${name}: every img carries border=0 and display:block`, () => {
    const { html } = toHtml(doc);
    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
      assert.match(tag, /border="0"/, `missing border=0: ${tag}`);
      assert.match(tag, /display:block/, `missing display:block: ${tag}`);
    }
  });

  test(`${name}: every layout table resets spacing and is role=presentation`, () => {
    const { html } = toHtml(doc);
    for (const tag of html.match(/<table[^>]*>/g) ?? []) {
      assert.match(tag, /role="presentation"/, `missing role: ${tag}`);
      assert.match(tag, /cellpadding="0"/, `missing cellpadding: ${tag}`);
      assert.match(tag, /cellspacing="0"/, `missing cellspacing: ${tag}`);
    }
  });

  test(`${name}: no event handlers or executable URLs survive`, () => {
    const { html } = toHtml(doc);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
    assert.doesNotMatch(html, /(href|src)\s*=\s*["']\s*javascript:/i);
    assert.doesNotMatch(html, /<script/i);
  });
}

test("the mobile media query only appears when a column actually stacks", () => {
  setIdFactory((() => { let n = 0; return () => `s${++n}`; })());
  const noColumns = emptyDocument();
  assert.doesNotMatch(toHtml(noColumns).html, /@media/);

  const stacking = emptyDocument();
  stacking.blocks = [createSection([createBlock("columns")])];
  assert.match(toHtml(stacking).html, /@media only screen and \(max-width:580px\)/);

  const notStacking = emptyDocument();
  notStacking.blocks = [
    createSection([set(createBlock("columns"), { stackOnMobile: false })]),
  ];
  assert.doesNotMatch(toHtml(notStacking).html, /@media/);
});

test("each distinct column gap gets its own stacked-mobile rule", () => {
  const doc = emptyDocument();
  doc.blocks = [
    createSection([
      set(createBlock("columns"), { gap: 16 }),
      set(createBlock("columns"), { gap: 32 }),
      set(createBlock("columns"), { gap: 16 }),
    ]),
  ];
  const { html } = toHtml(doc);
  assert.match(html, /\.md-cg16\+\.md-cg16\{padding-top:16px!important\}/);
  assert.match(html, /\.md-cg32\+\.md-cg32\{padding-top:32px!important\}/);
  assert.equal((html.match(/md-cg16\+/g) ?? []).length, 1, "no duplicate rule per gap");
});

test("column widths always total exactly 100", () => {
  const cases = [
    [{}, {}],
    [{}, {}, {}],
    [{ width: 33.33 }, {}, {}],
    [{ width: 70 }, { width: 30 }],
    [{}],
  ];
  for (const columns of cases) {
    const widths = computeWidths(columns);
    const total = widths.reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(total - 100) < 0.001,
      `${JSON.stringify(columns)} -> ${JSON.stringify(widths)} = ${total}`,
    );
  }
});

test("an empty block contributes no table row at all", () => {
  const doc = emptyDocument();
  // An image with no src has nothing to render; it must not leave an empty padded cell.
  doc.blocks = [createSection([createBlock("image")])];
  const { html } = toHtml(doc);
  assert.doesNotMatch(html, /<img/);
});

test("the preheader is present when set and absent when not", () => {
  const without = emptyDocument();
  assert.doesNotMatch(toHtml(without).html, /mso-hide:all/);

  const withText = emptyDocument();
  withText.settings.preheader = "Kort förhandsvisning";
  const { html } = toHtml(withText);
  assert.match(html, /mso-hide:all/);
  assert.match(html, /Kort förhandsvisning/);
});

test("every checked-in fixture is a structurally valid document", async () => {
  const { validateDocument } = await import("../dist/index.js");
  for (const [name, doc] of docs) {
    const result = validateDocument(doc);
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.issues)}`);
  }
});

test("the content column is fluid, so a phone never scrolls sideways", () => {
  const doc = emptyDocument();
  const { html } = toHtml(doc);

  // The real container must be width:100% capped by max-width...
  assert.match(html, /width="100%" style="width:100%;max-width:600px/);

  // ...and the only literal 600px table width may live inside an Outlook ghost table,
  // because Outlook ignores max-width and would otherwise stretch to the whole window.
  const ghosts = html.match(/<!--\[if mso\]><table[^>]*width="600"[^>]*>/g) ?? [];
  assert.ok(ghosts.length > 0, "Outlook needs a ghost table of the real width");

  const withoutConditionals = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, "");
  assert.doesNotMatch(
    withoutConditionals,
    /<table[^>]*\swidth="\d+"/,
    "no fixed pixel table width outside a conditional comment",
  );
});
