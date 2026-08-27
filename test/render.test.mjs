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
import {
  createBlock,
  createColumn,
  createSection,
  emptyDocument,
  setIdFactory,
} from "../dist/document.js";

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

  test(`${name}: line height is in px, with the rule Outlook needs`, () => {
    const { html } = toHtml(doc);
    // Outlook's Word engine ignores a unitless line-height and substitutes its own, which
    // silently changes the vertical rhythm of every paragraph.
    // `inherit` and `100%` are client resets, not layout values.
    for (const decl of html.match(/line-height:[^;"}\n]*/g) ?? []) {
      assert.match(
        decl,
        /line-height:\s*(0|\d+px|100%|inherit)/,
        `unitless line height would be ignored by Outlook: ${decl}`,
      );
    }
    if (/font-size:\d+px;line-height:\d+px/.test(html)) {
      assert.match(html, /mso-line-height-rule:exactly/);
    }
  });

  test(`${name}: no blanket font override for Outlook`, () => {
    const { html } = toHtml(doc);
    // An !important font-family inside an [if mso] block overrides every deliberate choice
    // in the document. Only ever correct for a webfont, and this renderer offers none.
    for (const conditional of html.match(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g) ?? []) {
      assert.doesNotMatch(
        conditional,
        /font-family[^;}]*!important/,
        "an MSO font override would destroy the document's own typography in Outlook",
      );
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
    for (const options of [{}, { totalWidth: 600, gap: 24 }]) {
      const widths = computeWidths(columns, options);
      const total = widths.reduce((a, b) => a + b, 0);
      assert.ok(
        Math.abs(total - 100) < 0.001,
        `${JSON.stringify(columns)} ${JSON.stringify(options)} -> ${JSON.stringify(widths)} = ${total}`,
      );
    }
  }
});

test("the gap is taken out of the percentages so every column gets equal content width", () => {
  // Three equal columns in a 600px row with a 24px gap. The gap sits as padding-right on
  // the first two, so their boxes must be wider by exactly that much — otherwise the middle
  // column renders a gap narrower than its neighbours and a three-up image grid goes ragged.
  const totalWidth = 600;
  const gap = 24;
  const widths = computeWidths([{}, {}, {}], { totalWidth, gap });

  const contentPx = widths.map((w, i) => {
    const box = (w / 100) * totalWidth;
    return box - (i < 2 ? gap : 0);
  });

  const spread = Math.max(...contentPx) - Math.min(...contentPx);
  assert.ok(spread < 0.5, `content widths differ by ${spread}px: ${JSON.stringify(contentPx)}`);
  assert.ok(
    Math.abs(contentPx[0] - (totalWidth - 2 * gap) / 3) < 0.5,
    "each column should get an equal share of what is left after the gaps",
  );
});

test("many columns still divide the row exactly", () => {
  for (const n of [4, 5, 6]) {
    const widths = computeWidths(Array.from({ length: n }, () => ({})), {
      totalWidth: 600,
      gap: 16,
    });
    assert.equal(widths.length, n);
    const total = widths.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 100) < 0.001, `${n} columns summed to ${total}`);

    // Equal content widths, the same guarantee three columns get.
    const content = widths.map((w, i) => (w / 100) * 600 - (i < n - 1 ? 16 : 0));
    const spread = Math.max(...content) - Math.min(...content);
    assert.ok(spread < 0.5, `${n} columns differ by ${spread}px`);
  }
});

test("a mix of fixed and shared widths splits only the remainder", () => {
  // "Sidebar at 30%, the rest shares what is left" — the useful case, and one number.
  const widths = computeWidths([{ width: 30 }, {}, {}], { totalWidth: 600, gap: 0 });
  assert.ok(Math.abs(widths[0] - 30) < 0.01);
  assert.ok(Math.abs(widths[1] - 35) < 0.01);
  assert.ok(Math.abs(widths[2] - 35) < 0.01);
});

test("widths that add up to more than 100 still produce a row that fits", () => {
  // The inspector warns about this, but the renderer must not emit a row wider than 100%
  // whatever it is handed — Outlook would push the second column out of the mail.
  const widths = computeWidths([{ width: 70 }, { width: 70 }], { totalWidth: 600, gap: 0 });
  const total = widths.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 0.001, `summed to ${total}`);
  assert.ok(widths[1] < widths[0], "the last column absorbs the overflow");
});

test("explicit column widths still describe the content, not the box", () => {
  const totalWidth = 600;
  const gap = 20;
  const widths = computeWidths([{ width: 25 }, { width: 75 }], { totalWidth, gap });
  const firstContent = (widths[0] / 100) * totalWidth - gap;
  assert.ok(
    Math.abs(firstContent - 0.25 * (totalWidth - gap)) < 0.5,
    `25% column got ${firstContent}px of content`,
  );
});

test("without a row width the gap cannot be compensated, and shares pass through", () => {
  assert.deepEqual(computeWidths([{}, {}]), [50, 50]);
  assert.deepEqual(computeWidths([{}, {}], { gap: 24 }), [50, 50]);
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
  withText.settings.preheader = "Short preview text";
  const { html } = toHtml(withText);
  assert.match(html, /mso-hide:all/);
  assert.match(html, /Short preview text/);
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


test("long unbroken text cannot widen the table in Outlook", () => {
  const doc = emptyDocument();
  doc.blocks = [
    createSection([
      set(createBlock("text"), {
        html: "<p>https://exempel.se/en/mycket/lang/url/utan/nagra/blanksteg/alls/i/den</p>",
      }),
    ]),
  ];
  assert.match(toHtml(doc).html, /word-break:break-word/);
});

test("a coloured column carries bgcolor as well as the CSS", () => {
  const doc = emptyDocument();
  const cols = set(createBlock("columns"), {
    columns: [
      Object.assign(createColumn([createBlock("text")]), { backgroundColor: "#ff0000" }),
      createColumn([createBlock("text")]),
    ],
  });
  doc.blocks = [createSection([cols])];
  const { html } = toHtml(doc);
  // Older Outlook and some gateways drop background-color from a cell but honour the
  // attribute, so a coloured column needs both.
  assert.match(html, /bgcolor="#ff0000"/);
  assert.match(html, /background-color:#ff0000/);
});

test("mobile padding becomes one media-query rule per distinct value", () => {
  const doc = emptyDocument();
  const a = set(createBlock("text"), { padding: [24, 24, 24, 24], mobilePadding: [12, 12, 12, 12] });
  const b = set(createBlock("text"), { padding: [40, 40, 40, 40], mobilePadding: [12, 12, 12, 12] });
  const c = set(createBlock("text"), { padding: [8, 8, 8, 8], mobilePadding: [4, 4, 4, 4] });
  doc.blocks = [createSection([a, b, c])];
  const { html } = toHtml(doc);

  const rules = html.match(/\.md-mp\d\{padding:[^}]+\}/g) ?? [];
  assert.equal(rules.length, 2, "two distinct values, not three blocks");
  assert.ok(rules.some((r) => /padding:12px 12px 12px 12px!important/.test(r)));
  assert.ok(rules.some((r) => /padding:4px 4px 4px 4px!important/.test(r)));

  // The desktop padding stays inline, so a client that strips <style> still gets a layout.
  assert.match(html, /padding:24px 24px 24px 24px/);
  assert.match(html, /padding:40px 40px 40px 40px/);

  // And the two blocks sharing a value share the class.
  const used = [...html.matchAll(/class="(md-mp\d)"/g)].map((m) => m[1]);
  assert.equal(new Set(used).size, 2);
  assert.equal(used.length, 3);
});

test("no mobile padding means no rule and no class", () => {
  const { html } = toHtml(emptyDocument());
  assert.doesNotMatch(html, /md-mp/);
});

test("a column's vertical alignment reaches both the attribute and the style", () => {
  const doc = emptyDocument();
  const section = doc.blocks[0];
  const columns = {
    id: "cols",
    type: "columns",
    gap: 16,
    stackOnMobile: true,
    columns: [
      { id: "a", verticalAlign: "middle", children: [{ id: "t1", type: "text", html: "<p>a</p>", align: "left" }] },
      { id: "b", verticalAlign: "bottom", children: [{ id: "t2", type: "text", html: "<p>b</p>", align: "left" }] },
    ],
  };
  const withCols = { ...doc, blocks: [{ ...section, children: [columns] }] };
  const { html } = toHtml(withCols);

  // Both, because Outlook's Word engine ignores the CSS property and honours the attribute.
  assert.match(html, /valign="middle"[^>]*vertical-align:middle/);
  assert.match(html, /valign="bottom"[^>]*vertical-align:bottom/);
});

test("columns default to top alignment, which is what an email should do", () => {
  const doc = emptyDocument();
  const section = doc.blocks[0];
  const columns = {
    id: "cols",
    type: "columns",
    gap: 16,
    stackOnMobile: true,
    columns: [
      { id: "a", children: [{ id: "t1", type: "text", html: "<p>a</p>", align: "left" }] },
      { id: "b", children: [{ id: "t2", type: "text", html: "<p>b</p>", align: "left" }] },
    ],
  };
  const { html } = toHtml({ ...doc, blocks: [{ ...section, children: [columns] }] });
  assert.equal((html.match(/valign="top"/g) ?? []).length, 2);
});
