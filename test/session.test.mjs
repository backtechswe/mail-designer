/**
 * The save-state machine. Autosave makes the happy path uninteresting; what matters is the
 * unhappy states, because those are what the prompts and the status line are about.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateName,
  hasUnsavedWork,
  initialStatus,
  statusReducer,
} from "../dist/session/status.js";

const start = () => initialStatus("Utkast");

test("a document starts unsaved and unnamed in the store", () => {
  const s = start();
  assert.equal(s.state, "new");
  assert.equal(s.id, null);
  assert.equal(hasUnsavedWork(s), false, "nothing has been typed yet, so nothing is at risk");
});

test("the first edit makes it dirty; the first save gives it an id", () => {
  let s = statusReducer(start(), { type: "edited" });
  assert.equal(s.state, "dirty");
  assert.equal(hasUnsavedWork(s), true);

  s = statusReducer(s, { type: "saveStarted" });
  assert.equal(s.state, "saving");
  assert.equal(hasUnsavedWork(s), true, "in flight is not yet safe");

  s = statusReducer(s, { type: "saveSucceeded", id: "abc", name: "Utkast", at: "2026-01-01T10:00:00Z" });
  assert.equal(s.state, "clean");
  assert.equal(s.id, "abc");
  assert.equal(s.savedAt, "2026-01-01T10:00:00Z");
  assert.equal(hasUnsavedWork(s), false);
});

test("an edit during a save leaves the document dirty when that save lands", () => {
  // The write already in flight is stale. Rather than cancel it we let it finish and
  // remember another is owed, so the store never sees out-of-order writes.
  let s = statusReducer(start(), { type: "edited" });
  s = statusReducer(s, { type: "saveStarted" });
  s = statusReducer(s, { type: "edited" });
  assert.equal(s.state, "saving", "still saving");
  assert.equal(s.pending, true, "…but another save is owed");

  s = statusReducer(s, { type: "saveSucceeded", id: "abc", name: "n", at: "t" });
  assert.equal(s.state, "dirty", "not clean — there is newer work than what was written");
  assert.equal(s.pending, false);
});

test("a failed save reports the error and still counts as unsaved work", () => {
  let s = statusReducer(start(), { type: "edited" });
  s = statusReducer(s, { type: "saveStarted" });
  s = statusReducer(s, { type: "saveFailed", error: "offline" });
  assert.equal(s.state, "error");
  assert.equal(s.error, "offline");
  assert.equal(hasUnsavedWork(s), true, "this is exactly when a leave prompt must fire");
});

test("editing after a failure clears the error but keeps the work pending", () => {
  let s = statusReducer(start(), { type: "edited" });
  s = statusReducer(s, { type: "saveFailed", error: "offline" });
  s = statusReducer(s, { type: "edited" });
  assert.equal(s.state, "dirty");
  assert.equal(s.error, undefined);
});

test("opening a document resets the state to match what was opened", () => {
  let s = statusReducer(start(), { type: "edited" });
  s = statusReducer(s, { type: "opened", id: "xyz", name: "Kampanj", savedAt: "t" });
  assert.equal(s.state, "clean");
  assert.equal(s.id, "xyz");
  assert.equal(s.name, "Kampanj");
  assert.equal(hasUnsavedWork(s), false);

  // Starting a fresh unsaved document.
  s = statusReducer(s, { type: "opened", id: null, name: "Utkast 2" });
  assert.equal(s.state, "new");
  assert.equal(s.id, null);
});

test("renaming a clean document makes it dirty, but does not disturb a failed one", () => {
  let s = statusReducer(start(), { type: "opened", id: "a", name: "Ett" });
  s = statusReducer(s, { type: "renamed", name: "Två" });
  assert.equal(s.name, "Två");
  assert.equal(s.state, "dirty", "the new name still has to reach the store");

  let e = statusReducer(start(), { type: "saveFailed", error: "boom" });
  e = statusReducer(e, { type: "renamed", name: "Tre" });
  assert.equal(e.state, "error", "renaming does not paper over a failure");
});

test("generated names are dated so a list of drafts can be told apart", () => {
  const a = generateName("Utkast {{date}}", new Date("2026-03-04T09:05:00Z"), "sv-SE");
  const b = generateName("Utkast {{date}}", new Date("2026-03-04T14:40:00Z"), "sv-SE");
  assert.match(a, /^Utkast /);
  assert.notEqual(a, b, "two drafts made the same day must not share a name");
});
