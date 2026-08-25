import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  canInsert,
  cloneBlock,
  createBlock,
  createColumn,
  createSection,
  duplicateBlock,
  emptyDocument,
  findBlock,
  findColumn,
  insertBlock,
  listContainers,
  moveBlock,
  removeBlock,
  setIdFactory,
  updateBlock,
  updateColumn,
} from "../dist/document.js";

let counter = 0;
beforeEach(() => {
  counter = 0;
  setIdFactory(() => `id${++counter}`);
});

/** section > [columns[colA:[text], colB:[text]], text] */
function twoColumnDoc() {
  const doc = emptyDocument();
  const colA = createColumn([createBlock("text")]);
  const colB = createColumn([createBlock("text")]);
  const columns = Object.assign(createBlock("columns"), { columns: [colA, colB] });
  const trailing = createBlock("text");
  doc.blocks = [createSection([columns, trailing])];
  return { doc, colA, colB, columns, trailing, section: doc.blocks[0] };
}

test("findBlock locates blocks at every depth and reports the container", () => {
  const { doc, colA, section } = twoColumnDoc();
  const leaf = colA.children[0];

  assert.equal(findBlock(doc, section.id).container.kind, "document");
  assert.equal(findBlock(doc, section.children[0].id).container.kind, "section");

  const found = findBlock(doc, leaf.id);
  assert.equal(found.container.kind, "column");
  assert.equal(found.container.id, colA.id);
  assert.equal(found.index, 0);

  assert.equal(findBlock(doc, "nope"), undefined);
});

test("listContainers walks document, sections and columns in order", () => {
  const { doc, colA, colB, section } = twoColumnDoc();
  const kinds = listContainers(doc).map((c) => c.container.kind);
  assert.deepEqual(kinds, ["document", "section", "column", "column"]);

  const ids = listContainers(doc).map((c) => c.container.id);
  assert.deepEqual(ids, [undefined, section.id, colA.id, colB.id]);
});

test("canInsert encodes the nesting rules", () => {
  const section = createBlock("section");
  const columns = createBlock("columns");
  const text = createBlock("text");

  assert.equal(canInsert(section, { kind: "document" }), true);
  assert.equal(canInsert(text, { kind: "document" }), false);
  assert.equal(canInsert(columns, { kind: "section", id: "x" }), true);
  assert.equal(canInsert(text, { kind: "section", id: "x" }), true);
  // Nested columns are the thing that breaks email layouts, so they are simply not allowed.
  assert.equal(canInsert(columns, { kind: "column", id: "x" }), false);
  assert.equal(canInsert(text, { kind: "column", id: "x" }), true);
});

test("insertBlock clamps the index instead of leaving a hole", () => {
  const { doc, section } = twoColumnDoc();
  const block = createBlock("divider");
  const next = insertBlock(doc, block, { container: { kind: "section", id: section.id }, index: 99 });
  const children = next.blocks[0].children;
  assert.equal(children[children.length - 1].id, block.id);
});

test("insertBlock refuses an illegal nesting rather than corrupting the tree", () => {
  const { doc, colA } = twoColumnDoc();
  assert.throws(
    () => insertBlock(doc, createBlock("columns"), { container: { kind: "column", id: colA.id }, index: 0 }),
    /Cannot insert a "columns" block into a column container/,
  );
});

test("moveBlock carries a leaf between two columns", () => {
  const { doc, colA, colB } = twoColumnDoc();
  const leaf = colA.children[0];

  const next = moveBlock(doc, leaf.id, { container: { kind: "column", id: colB.id }, index: 0 });

  assert.equal(findColumn(next, colA.id).children.length, 0);
  const target = findColumn(next, colB.id).children;
  assert.equal(target.length, 2);
  assert.equal(target[0].id, leaf.id);
});

test("moveBlock out of a column and up to the section", () => {
  const { doc, colA, section } = twoColumnDoc();
  const leaf = colA.children[0];

  const next = moveBlock(doc, leaf.id, { container: { kind: "section", id: section.id }, index: 0 });

  assert.equal(findColumn(next, colA.id).children.length, 0);
  assert.equal(next.blocks[0].children[0].id, leaf.id);
});

test("moveBlock compensates for its own removal when moving down in one container", () => {
  const doc = emptyDocument();
  const a = createBlock("text");
  const b = createBlock("divider");
  const c = createBlock("spacer");
  doc.blocks = [createSection([a, b, c])];
  const container = { kind: "section", id: doc.blocks[0].id };

  // Asking for index 2 means "end up after c", not "end up at slot 2 of the shortened list".
  const next = moveBlock(doc, a.id, { container, index: 3 });
  assert.deepEqual(next.blocks[0].children.map((x) => x.id), [b.id, c.id, a.id]);

  const back = moveBlock(next, a.id, { container, index: 0 });
  assert.deepEqual(back.blocks[0].children.map((x) => x.id), [a.id, b.id, c.id]);
});

test("moveBlock to its own position is a no-op that keeps identity", () => {
  const { doc, section } = twoColumnDoc();
  const first = section.children[0];
  const next = moveBlock(doc, first.id, { container: { kind: "section", id: section.id }, index: 0 });
  assert.equal(next, doc);
});

test("moveBlock into an illegal container leaves the document untouched", () => {
  const { doc, colA } = twoColumnDoc();
  const columns = doc.blocks[0].children[0];
  const next = moveBlock(doc, columns.id, { container: { kind: "column", id: colA.id }, index: 0 });
  assert.equal(next, doc);
});

test("removeBlock drops a section together with its children", () => {
  const { doc, colA } = twoColumnDoc();
  const leafId = colA.children[0].id;
  const next = removeBlock(doc, doc.blocks[0].id);
  assert.equal(next.blocks.length, 0);
  assert.equal(findBlock(next, leafId), undefined);
});

test("removeBlock of an unknown id returns the same document", () => {
  const { doc } = twoColumnDoc();
  assert.equal(removeBlock(doc, "missing"), doc);
});

test("updateBlock patches in place without touching siblings", () => {
  const { doc, trailing, section } = twoColumnDoc();
  const next = updateBlock(doc, trailing.id, { html: "Ny text" });
  assert.equal(findBlock(next, trailing.id).block.html, "Ny text");
  assert.equal(next.blocks[0].children[0].id, section.children[0].id);
  assert.equal(doc.blocks[0].children[1].html, trailing.html, "input document is untouched");
});

test("updateColumn patches column properties", () => {
  const { doc, colB } = twoColumnDoc();
  const next = updateColumn(doc, colB.id, { width: 40, backgroundColor: "#fff" });
  assert.equal(findColumn(next, colB.id).width, 40);
  assert.equal(findColumn(next, colB.id).backgroundColor, "#fff");
});

test("cloneBlock gives every nested node a fresh id", () => {
  const { columns } = twoColumnDoc();
  const copy = cloneBlock(columns);

  assert.notEqual(copy.id, columns.id);
  assert.notEqual(copy.columns[0].id, columns.columns[0].id);
  assert.notEqual(copy.columns[0].children[0].id, columns.columns[0].children[0].id);
  assert.equal(copy.columns.length, 2);
});

test("duplicateBlock inserts the copy directly after the original", () => {
  const { doc, trailing, section } = twoColumnDoc();
  const next = duplicateBlock(doc, trailing.id);
  const children = next.blocks[0].children;
  assert.equal(children.length, 3);
  assert.equal(children[1].id, trailing.id);
  assert.equal(children[2].type, "text");
  assert.notEqual(children[2].id, trailing.id);
  assert.equal(findBlock(next, section.id).block.children.length, 3);
});
