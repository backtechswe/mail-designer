/**
 * The history state machine. Undo/redo is the kind of logic that looks obviously correct
 * and then loses a step at a boundary; clicking buttons in a browser is a poor way to find
 * that out, which is why the reducer is pure and tested directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RUN_TIMEOUT_MS,
  historyReducer,
  initialHistory,
  redoLabel,
  redoTarget,
  undoLabel,
  undoTarget,
} from "../dist/editor/history.js";

const LIMIT = 200;

const doc = (n) => ({ version: 1, settings: {}, blocks: [], marker: n });

const commit = (state, previous, label, opts = {}) =>
  historyReducer(state, {
    type: "commit",
    previous,
    label,
    coalesceKey: opts.key,
    at: opts.at ?? 0,
    limit: opts.limit ?? LIMIT,
    coalesceMs: opts.coalesceMs ?? DEFAULT_RUN_TIMEOUT_MS,
  });

test("a commit records the document as it was, not the one replacing it", () => {
  const s = commit(initialHistory, doc(1), "Ändrade innehåll");
  assert.equal(s.past.length, 1);
  assert.equal(undoTarget(s).marker, 1);
  assert.equal(undoLabel(s), "Ändrade innehåll");
  assert.equal(s.future.length, 0);
});

test("undo and redo walk the same steps in both directions", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "a");
  s = commit(s, doc(2), "b");
  // On screen: doc(3).
  assert.equal(undoLabel(s), "b");

  s = historyReducer(s, { type: "undo", current: doc(3) });
  assert.equal(s.past.length, 1);
  assert.equal(s.future.length, 1);
  assert.equal(redoTarget(s).marker, 3, "redo returns to what was on screen");
  assert.equal(redoLabel(s), "b");
  assert.equal(undoLabel(s), "a");

  s = historyReducer(s, { type: "undo", current: doc(2) });
  assert.equal(s.past.length, 0);
  assert.equal(s.future.length, 2);

  s = historyReducer(s, { type: "redo", current: doc(1) });
  s = historyReducer(s, { type: "redo", current: doc(2) });
  assert.equal(s.past.length, 2);
  assert.equal(s.future.length, 0);
  assert.equal(undoLabel(s), "b", "the labels came back in the right order");
});

test("undo and redo at the ends of the stack are no-ops", () => {
  assert.equal(historyReducer(initialHistory, { type: "undo", current: doc(1) }), initialHistory);
  assert.equal(historyReducer(initialHistory, { type: "redo", current: doc(1) }), initialHistory);
  assert.equal(undoLabel(initialHistory), null);
  assert.equal(undoTarget(initialHistory), null);
});

test("a new commit clears the redo stack", () => {
  let s = commit(initialHistory, doc(1), "a");
  s = historyReducer(s, { type: "undo", current: doc(2) });
  assert.equal(s.future.length, 1);
  s = commit(s, doc(1), "b");
  assert.equal(s.future.length, 0, "you cannot redo into a branch you left");
});

test("commits sharing a key merge while they keep arriving", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "Ändrade innehåll", { key: "text:a", at: 0 });
  s = commit(s, doc(2), "Ändrade innehåll", { key: "text:a", at: 100 });
  s = commit(s, doc(3), "Ändrade innehåll", { key: "text:a", at: 200 });

  assert.equal(s.past.length, 1, "a burst of typing is one step");
  assert.equal(undoTarget(s).marker, 1, "undo lands before the whole burst, not inside it");
});

test("the backstop timeout does eventually close a run", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "x", { key: "text:a", at: 0, coalesceMs: 600 });
  s = commit(s, doc(2), "x", { key: "text:a", at: 700, coalesceMs: 600 });
  assert.equal(s.past.length, 2, "700ms is past the 600ms window this test set");
});

test("a different key never merges, even back to back", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "x", { key: "text:a", at: 0 });
  s = commit(s, doc(2), "x", { key: "text:b", at: 10 });
  assert.equal(s.past.length, 2, "typing in another block is its own step");

  let t = initialHistory;
  t = commit(t, doc(1), "x", { key: "update:a:fontSize", at: 0 });
  t = commit(t, doc(2), "x", { key: "update:a:color", at: 10 });
  assert.equal(t.past.length, 2, "another property of the same block is its own step too");
});

test("a commit without a key never merges", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "x", { at: 0 });
  s = commit(s, doc(2), "x", { at: 10 });
  assert.equal(s.past.length, 2);
});

test("stepping breaks the merge window", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "x", { key: "text:a", at: 0 });
  s = historyReducer(s, { type: "undo", current: doc(2) });
  s = historyReducer(s, { type: "redo", current: doc(1) });
  // Same key, still inside the time window — but an undo happened in between.
  s = commit(s, doc(2), "x", { key: "text:a", at: 100 });
  assert.equal(s.past.length, 2, "the next keystroke must not fold into the restored step");
});

test("the stack is capped and drops the oldest steps first", () => {
  let s = initialHistory;
  for (let i = 0; i < 12; i += 1) s = commit(s, doc(i), `step ${i}`, { limit: 10 });
  assert.equal(s.past.length, 10);
  assert.equal(s.past[0].document.marker, 2, "the two oldest were dropped");
  assert.equal(undoLabel(s), "step 11");
});

test("a long history really is long", () => {
  let s = initialHistory;
  for (let i = 0; i < 250; i += 1) s = commit(s, doc(i), `step ${i}`);
  assert.equal(s.past.length, LIMIT);
  // And it can be walked all the way back.
  for (let i = 0; i < LIMIT; i += 1) s = historyReducer(s, { type: "undo", current: doc(-1) });
  assert.equal(s.past.length, 0);
  assert.equal(s.future.length, LIMIT);
});

test("an explicit break ends the run, so the next change is its own step", () => {
  let s = initialHistory;
  s = commit(s, doc(1), "x", { key: "text:a", at: 0 });
  s = historyReducer(s, { type: "break" });
  s = commit(s, doc(2), "x", { key: "text:a", at: 50 });
  assert.equal(s.past.length, 2, "leaving the field and coming back is a new edit");
});

test("break on an already-closed run changes nothing", () => {
  const s = commit(initialHistory, doc(1), "x", { at: 0 });
  assert.equal(historyReducer(s, { type: "break" }), s, "same object, so React skips a render");
});

test("a run merges across a slow burst, not just a fast one", () => {
  // The original 600ms window was the bug: on a document heavy enough that a render takes a
  // few hundred milliseconds, the browser delays the next input event, so consecutive
  // keystrokes arrived a second apart and every digit became its own undo step.
  let s = initialHistory;
  s = commit(s, doc(1), "x", { key: "update:a:fontSize", at: 0 });
  s = commit(s, doc(2), "x", { key: "update:a:fontSize", at: 999 });
  s = commit(s, doc(3), "x", { key: "update:a:fontSize", at: 2500 });
  assert.equal(s.past.length, 1, "one adjustment session is one step");
  assert.equal(undoTarget(s).marker, 1, "undo lands before the burst, not on a half-typed value");
});

test("the default run timeout is a backstop, not the primary rule", () => {
  assert.ok(
    DEFAULT_RUN_TIMEOUT_MS >= 10_000,
    "runs end on real events — blur, reselection, another property — so the timer only has " +
      "to catch a run nothing ever closes",
  );
});

test("clear empties both stacks", () => {
  let s = commit(initialHistory, doc(1), "a");
  s = historyReducer(s, { type: "undo", current: doc(2) });
  s = historyReducer(s, { type: "clear" });
  assert.deepEqual(s, initialHistory);
});
