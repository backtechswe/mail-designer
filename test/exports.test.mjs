/**
 * The public surface, checked against itself.
 *
 * A type that appears in a public prop but is exported from nowhere is a paper cut with a
 * long tail: the consumer either re-derives it (`MailDesignerProps["fields"][number]`) or
 * copies it, and then their copy and ours drift. These tests read the built declarations, so
 * they fail for the reason a consumer would.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("dist/index.d.ts", "utf8");
const render = readFileSync("dist/render/index.d.ts", "utf8");

test("DataField is exported, being the element type of the public fields prop", () => {
  const props = readFileSync("dist/MailDesigner.d.ts", "utf8");
  assert.match(props, /fields\?:\s*readonly DataField\[\]/, "still the shape of the prop");
  for (const [name, entry] of [["main", main], ["render", render]]) {
    assert.match(entry, /\bDataField\b/, `${name} entry must export DataField`);
  }
});

test("the layout CSS does not depend on which optional children a host renders", () => {
  // `grid-template-rows: auto auto minmax(0,1fr) auto` numbered the rows and trusted the
  // children to arrive in the numbered order. Without a TemplateStore there is no document
  // bar, so every child shifted up one: the 1fr landed on the data panel and the panels row
  // collapsed. Read structurally, because the failure is invisible in any host that happens
  // to render every optional part.
  // Declarations only — the comment explaining what was wrong with the old rule names it.
  const css = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const root = /\n\.md-root \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
  assert.ok(root, "found the .md-root rule");
  assert.doesNotMatch(root, /grid-template-rows/, "row positions cannot be assumed");
  assert.match(root, /flex-direction: column/);
  assert.match(/\.md-layout \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "", /flex: 1 1 auto/);
});
