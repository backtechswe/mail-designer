/**
 * findDropTarget composed with moveBlock.
 *
 * Both had their own passing tests while dragging a block downwards moved it nowhere. The bug
 * lived in the seam: the drop target was an index into a list with the dragged block removed,
 * moveBlock expected an index into the real list and compensated for the removal itself, and
 * the two compensations cancelled out in one direction only. So this file tests the pipeline,
 * not the parts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findDropTarget } from "../dist/editor/dnd/findDropTarget.js";
import { moveBlock } from "../dist/document.js";

const ROW = 100;

/**
 * Stands in for measure(): stacked rows of equal height, with the dragged block still in the
 * list exactly as the real measurement leaves it.
 */
function measure(container, ids) {
  return [
    {
      container,
      rect: { top: 0, left: 0, width: 600, height: ROW * ids.length },
      depth: container.kind === "document" ? 0 : 1,
      children: ids.map((id, i) => ({
        id,
        rect: { top: i * ROW, left: 0, width: 600, height: ROW },
      })),
    },
  ];
}

/** Drops the block onto the row at `slot`, in its upper or lower half. */
function drop(doc, container, ids, id, slot, half) {
  const containers = measure(container, ids);
  const y = slot * ROW + (half === "upper" ? ROW * 0.25 : ROW * 0.75);
  const target = findDropTarget({ x: 300, y }, containers, () => true);
  return moveBlock(doc, id, { container: target.container, index: target.index });
}

const section = (id) => ({ id, type: "section", children: [] });
const text = (id) => ({ id, type: "text", html: id, align: "left" });
const docOf = (...sections) => ({ version: 1, settings: {}, blocks: sections });
const order = (doc) => doc.blocks.map((b) => b.id);

test("a section dragged downwards lands where it was dropped", () => {
  // The reported bug: this used to leave the order untouched.
  const doc = docOf(section("A"), section("B"), section("C"));
  const container = { kind: "document" };

  // Drop A onto the lower half of B — it should end up between B and C.
  const afterB = drop(doc, container, ["A", "B", "C"], "A", 1, "lower");
  assert.deepEqual(order(afterB), ["B", "A", "C"]);

  // And onto the lower half of C — the end of the list.
  const afterC = drop(doc, container, ["A", "B", "C"], "A", 2, "lower");
  assert.deepEqual(order(afterC), ["B", "C", "A"]);
});

test("a section dragged upwards still lands where it was dropped", () => {
  const doc = docOf(section("A"), section("B"), section("C"));
  const container = { kind: "document" };

  const beforeB = drop(doc, container, ["A", "B", "C"], "C", 1, "upper");
  assert.deepEqual(order(beforeB), ["A", "C", "B"]);

  const beforeA = drop(doc, container, ["A", "B", "C"], "C", 0, "upper");
  assert.deepEqual(order(beforeA), ["C", "A", "B"]);
});

test("dropping a block back onto itself changes nothing", () => {
  const doc = docOf(section("A"), section("B"), section("C"));
  const container = { kind: "document" };
  assert.deepEqual(order(drop(doc, container, ["A", "B", "C"], "B", 1, "upper")), ["A", "B", "C"]);
  assert.deepEqual(order(drop(doc, container, ["A", "B", "C"], "B", 1, "lower")), ["A", "B", "C"]);
});

test("the same holds for leaves inside a section, in both directions", () => {
  const inner = ["x", "y", "z"];
  const doc = {
    version: 1,
    settings: {},
    blocks: [{ id: "S", type: "section", children: inner.map(text) }],
  };
  const container = { kind: "section", id: "S" };
  const childOrder = (d) => d.blocks[0].children.map((c) => c.id);

  assert.deepEqual(childOrder(drop(doc, container, inner, "x", 1, "lower")), ["y", "x", "z"]);
  assert.deepEqual(childOrder(drop(doc, container, inner, "x", 2, "lower")), ["y", "z", "x"]);
  assert.deepEqual(childOrder(drop(doc, container, inner, "z", 0, "upper")), ["z", "x", "y"]);
  assert.deepEqual(childOrder(drop(doc, container, inner, "y", 0, "upper")), ["y", "x", "z"]);
});

test("every slot in a four-item list is reachable, in both directions", () => {
  // A sweep rather than a spot check: the off-by-one only showed up at particular slots, and
  // an exhaustive pass is the cheapest way to be sure none is left.
  const ids = ["A", "B", "C", "D"];
  const doc = docOf(...ids.map(section));
  const container = { kind: "document" };

  for (const id of ids) {
    for (let slot = 0; slot < ids.length; slot += 1) {
      for (const half of ["upper", "lower"]) {
        const result = order(drop(doc, container, ids, id, slot, half));
        assert.equal(result.length, 4, "nothing lost or duplicated");
        assert.deepEqual([...result].sort(), ids, "same blocks, reordered");

        // Where the block should have landed, computed independently of the code under test.
        const boundary = half === "upper" ? slot : slot + 1;
        const others = ids.filter((x) => x !== id);
        const from = ids.indexOf(id);
        const expected = [...others];
        expected.splice(boundary > from ? boundary - 1 : boundary, 0, id);
        assert.deepEqual(result, expected, `${id} onto ${half} half of slot ${slot}`);
      }
    }
  }
});
