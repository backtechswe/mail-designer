/**
 * Golden-file conformance suite.
 *
 * The fixtures are plain JSON and the expected output is plain HTML, on purpose: this pair
 * is the renderer's specification, not just a regression net. Any other implementation —
 * a .NET port for an ASP.NET backend, say — is correct exactly when it turns these
 * fixtures into these files.
 *
 * Regenerate after an intentional change:  UPDATE_GOLDEN=1 node --test test/
 * Then *read the diff*. Every line in here is a deliberate email-client workaround, and a
 * blind accept is how one of them quietly disappears.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toHtml } from "../dist/render/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures");
const goldenDir = join(here, "golden");
const update = process.env.UPDATE_GOLDEN === "1";

const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));

for (const fixture of fixtures) {
  const name = fixture.replace(/\.json$/, "");
  const doc = JSON.parse(readFileSync(join(fixtureDir, fixture), "utf8"));

  test(`golden: ${name} html`, () => {
    const { html } = toHtml(doc, { title: "Test" });
    const file = join(goldenDir, `${name}.html`);
    if (update || !existsSync(file)) {
      writeFileSync(file, html);
      return;
    }
    assert.equal(html, readFileSync(file, "utf8"));
  });

  test(`golden: ${name} text`, () => {
    const { text } = toHtml(doc);
    const file = join(goldenDir, `${name}.txt`);
    if (update || !existsSync(file)) {
      writeFileSync(file, text);
      return;
    }
    assert.equal(text, readFileSync(file, "utf8"));
  });
}
