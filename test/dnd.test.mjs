/**
 * Drop-target selection. This is the part of drag-and-drop that cannot be verified by
 * dragging things around by hand — every case below is a specific way a hand-rolled
 * sorter goes subtly wrong.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findDropTarget } from "../dist/editor/dnd/findDropTarget.js";

const rect = (top, height, left = 0, width = 600) => ({ top, left, width, height });
const acceptAll = () => true;

/**
 *  document (0..400)
 *   └─ section (0..400)
 *       ├─ a (0..100)
 *       ├─ columns (100..300)
 *       │   ├─ colLeft  (100..300, x 0..300)
 *       │   │   └─ c1 (120..180)
 *       │   └─ colRight (100..300, x 300..600)
 *       └─ b (300..400)
 */
const containers = [
  {
    container: { kind: "document" },
    rect: rect(0, 400),
    depth: 0,
    children: [{ id: "section", rect: rect(0, 400) }],
  },
  {
    container: { kind: "section", id: "section" },
    rect: rect(0, 400),
    depth: 1,
    children: [
      { id: "a", rect: rect(0, 100) },
      { id: "columns", rect: rect(100, 200) },
      { id: "b", rect: rect(300, 100) },
    ],
  },
  {
    container: { kind: "column", id: "colLeft" },
    rect: rect(100, 200, 0, 300),
    depth: 2,
    children: [{ id: "c1", rect: rect(120, 60, 0, 300) }],
  },
  {
    container: { kind: "column", id: "colRight" },
    rect: rect(100, 200, 300, 300),
    depth: 2,
    children: [],
  },
];

test("the upper half of a block inserts before it, the lower half after", () => {
  const before = findDropTarget({ x: 100, y: 20 }, containers, acceptAll);
  assert.deepEqual(before.container, { kind: "section", id: "section" });
  assert.equal(before.index, 0);

  const after = findDropTarget({ x: 100, y: 80 }, containers, acceptAll);
  assert.equal(after.index, 1, "past a's midpoint means after a");
});

test("past the last child, the index is the end of the list", () => {
  const target = findDropTarget({ x: 100, y: 395 }, containers, acceptAll);
  assert.deepEqual(target.container, { kind: "section", id: "section" });
  assert.equal(target.index, 3);
  assert.equal(target.indicator.top, 400, "the line sits below the last block");
});

test("a point inside a column targets the column, not the section that encloses it", () => {
  // The point is inside document, section AND colLeft. The innermost must win, or every
  // drop into a column would land in the section instead.
  const target = findDropTarget({ x: 150, y: 130 }, containers, acceptAll);
  assert.deepEqual(target.container, { kind: "column", id: "colLeft" });
  assert.equal(target.index, 0);
});

test("the x coordinate decides which of two side-by-side columns is hit", () => {
  const left = findDropTarget({ x: 50, y: 200 }, containers, acceptAll);
  assert.equal(left.container.id, "colLeft");

  const right = findDropTarget({ x: 450, y: 200 }, containers, acceptAll);
  assert.equal(right.container.id, "colRight");
});

test("an empty container takes index 0 and draws the line at its top", () => {
  const target = findDropTarget({ x: 450, y: 200 }, containers, acceptAll);
  assert.equal(target.index, 0);
  assert.equal(target.indicator.top, 100);
  assert.equal(target.indicator.left, 300);
});

test("a container the block cannot enter is skipped, and the parent takes the drop", () => {
  // Exactly what happens when dragging a columns block over a column: illegal there, so
  // the section must catch it rather than the drag being refused.
  const notColumns = (c) => c.container.kind !== "column";
  const target = findDropTarget({ x: 150, y: 130 }, containers, notColumns);
  assert.deepEqual(target.container, { kind: "section", id: "section" });
});

test("a point outside everything still resolves, to the nearest container", () => {
  const target = findDropTarget({ x: 100, y: 900 }, containers, acceptAll);
  assert.ok(target, "a drag that strays past the edge must not be silently cancelled");
  assert.equal(target.container.kind, "section");
  assert.equal(target.index, 3);
});

test("no eligible container means no target", () => {
  assert.equal(findDropTarget({ x: 100, y: 100 }, containers, () => false), null);
  assert.equal(findDropTarget({ x: 100, y: 100 }, [], acceptAll), null);
});

test("the deepest hit wins even when several containers share an edge", () => {
  const stacked = [
    { container: { kind: "document" }, rect: rect(0, 100), depth: 0, children: [] },
    { container: { kind: "section", id: "s" }, rect: rect(0, 100), depth: 1, children: [] },
    { container: { kind: "column", id: "c" }, rect: rect(0, 100), depth: 2, children: [] },
  ];
  assert.deepEqual(findDropTarget({ x: 10, y: 50 }, stacked, acceptAll).container, {
    kind: "column",
    id: "c",
  });
});
