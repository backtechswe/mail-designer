/**
 * Permissions and the data-coverage check.
 *
 * The coverage check is the one that earns its tests: a confirmation mail that has quietly
 * lost [Date] does not throw, does not look broken, and reaches the recipient missing a
 * fact. Comparing the supplied data against the tokens actually present is the only way
 * anyone finds out before it is sent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowsBlockType,
  blockCapabilities,
  dataCoverage,
  lockedBlockIds,
  resolvePermissions,
} from "../dist/permissions.js";
import { createBlock, createColumn, createSection, emptyDocument, setIdFactory } from "../dist/document.js";

setIdFactory((() => { let n = 0; return () => `k${++n}`; })());
const set = (block, patch) => Object.assign(block, patch);

test("everything is permitted when nothing is configured", () => {
  const p = resolvePermissions();
  assert.equal(p.structure, true);
  assert.equal(p.content, true);
  assert.equal(p.appearance, true);
  assert.equal(p.mailSettings, true);
  assert.equal(p.data, "edit");
  assert.equal(p.blocks, null, "null means every type, which is not the same as an empty list");
  assert.deepEqual(p.requiredFields, []);
});

test("an explicit block list restricts the palette; omitting it does not", () => {
  const all = resolvePermissions();
  assert.equal(allowsBlockType(all, "html"), true);

  const limited = resolvePermissions({ blocks: ["text", "image"] });
  assert.equal(allowsBlockType(limited, "text"), true);
  assert.equal(allowsBlockType(limited, "html"), false);

  const none = resolvePermissions({ blocks: [] });
  assert.equal(allowsBlockType(none, "text"), false, "an empty list really means none");
});

test("a block lock can only take away, never grant", () => {
  const open = resolvePermissions();
  const readOnlyDoc = resolvePermissions({ content: false, structure: false });

  const plain = createBlock("text");
  assert.deepEqual(blockCapabilities(plain, open), {
    editContent: true, editAppearance: true, move: true, remove: true, locked: false,
  });

  // Locked block in an otherwise editable document.
  const locked = set(createBlock("text"), { locked: true });
  assert.deepEqual(blockCapabilities(locked, open), {
    editContent: false, editAppearance: false, move: false, remove: false, locked: true,
  });

  // Unlocked block in a restricted document stays restricted.
  const caps = blockCapabilities(plain, readOnlyDoc);
  assert.equal(caps.editContent, false);
  assert.equal(caps.move, false);
  assert.equal(caps.editAppearance, true, "appearance was not restricted");
  assert.equal(caps.locked, false, "the block itself is not locked — the document is");
});

test("a partial lock restricts only the aspects it names", () => {
  const open = resolvePermissions();
  const block = set(createBlock("text"), { locked: { content: true, move: true } });
  const caps = blockCapabilities(block, open);
  assert.equal(caps.editContent, false, "the words are fixed");
  assert.equal(caps.move, false);
  assert.equal(caps.editAppearance, true, "but it can still be restyled");
  assert.equal(caps.remove, true);
  assert.equal(caps.locked, true);
});

test("locked: false is the same as no lock at all", () => {
  const caps = blockCapabilities(set(createBlock("text"), { locked: false }), resolvePermissions());
  assert.equal(caps.locked, false);
  assert.equal(caps.editContent, true);
});

test("lockedBlockIds finds locks at every depth", () => {
  const doc = emptyDocument();
  const a = set(createBlock("text"), { locked: true });
  const nested = set(createBlock("text"), { locked: { content: true } });
  const cols = set(createBlock("columns"), {
    columns: [createColumn([nested]), createColumn([createBlock("text")])],
  });
  doc.blocks = [createSection([a, cols, createBlock("divider")])];
  assert.deepEqual(lockedBlockIds(doc), [a.id, nested.id]);
});

function docWithTokens(...htmls) {
  const doc = emptyDocument();
  doc.blocks = [createSection(htmls.map((html) => set(createBlock("text"), { html })))];
  return doc;
}

test("coverage separates what is shown from what was silently dropped", () => {
  const doc = docWithTokens("<p>Hi [Name], din tid är [Time].</p>");
  const c = dataCoverage(doc, { Name: "Anna", Time: "10.30", Date: "14 april", Pris: "450 kr" });

  assert.deepEqual(c.used.sort(), ["Name", "Time"]);
  assert.deepEqual(c.unused.sort(), ["Date", "Pris"], "supplied but never rendered");
  assert.deepEqual(c.withoutValue, []);
});

test("coverage reports tokens the data has no value for", () => {
  const doc = docWithTokens("<p>[Name] — [City]</p>");
  const c = dataCoverage(doc, { Name: "Anna" });
  assert.deepEqual(c.withoutValue, ["City"]);
  assert.deepEqual(c.unused, []);
});

test("coverage matches case-insensitively, the way substitution does", () => {
  const doc = docWithTokens("<p>[name]</p>");
  const c = dataCoverage(doc, { Name: "Anna" });
  assert.deepEqual(c.used, ["Name"]);
  assert.deepEqual(c.unused, []);
  assert.deepEqual(c.withoutValue, []);
});

test("a required field missing from the email is reported separately", () => {
  const doc = docWithTokens("<p>Hi [Name]</p>");
  const c = dataCoverage(doc, { Name: "Anna", Date: "14 april" }, ["Name", "Date"]);
  assert.deepEqual(c.missingRequired, ["Date"], "this is the one that should block a send");
  assert.deepEqual(c.unused, ["Date"]);

  const ok = dataCoverage(docWithTokens("<p>[Name] [Date]</p>"), { Name: "a", Date: "b" }, ["Name", "Date"]);
  assert.deepEqual(ok.missingRequired, []);
});

test("coverage looks in button labels and URLs too", () => {
  const doc = emptyDocument();
  doc.blocks = [
    createSection([
      set(createBlock("button"), { label: "Book in [City]", href: "https://x.se?id=[CustomerNo]" }),
    ]),
  ];
  const c = dataCoverage(doc, { City: "Kalmar", CustomerNo: "42" });
  assert.deepEqual(c.used.sort(), ["City", "CustomerNo"], "a token hiding in a URL still counts as shown");
});
