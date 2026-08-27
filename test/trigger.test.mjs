/**
 * When the caret is asking for a data field.
 *
 * The email-address case is the whole reason this is a tested pure function rather than a
 * regex written inline: an off-by-one here pops a menu over someone's address as they type it,
 * and that is not a thing to verify by hand.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findTrigger, rankFields } from "../dist/data/trigger.js";

const at = (text) => findTrigger(text);

test("@ after a space opens it", () => {
  assert.deepEqual(at("Hey @"), { char: "@", from: 4, query: "" });
  assert.deepEqual(at("Hey @na"), { char: "@", from: 4, query: "na" });
});

test("@ at the very start of a run opens it", () => {
  // A text run usually begins after an element boundary, which is the start of a line.
  assert.deepEqual(at("@"), { char: "@", from: 0, query: "" });
  assert.deepEqual(at("@Nam"), { char: "@", from: 0, query: "Nam" });
});

test("an email address does not open it — the whole point of the boundary rule", () => {
  assert.equal(at("niklas@"), null);
  assert.equal(at("niklas@ninetech"), null);
  assert.equal(at("niklas@ninetech.com"), null);
  assert.equal(at("Skriv till niklas@ninetech.com"), null);
  assert.equal(at("contact.us@example"), null);
});

test("an address after a legitimate trigger closes it again", () => {
  // "Hey @" opens, then the user turns out to be typing an address after all.
  assert.deepEqual(at("Hey @anna"), { char: "@", from: 4, query: "anna" });
  assert.equal(at("Hey @anna@example.com"), null, "a second @ means an address");
});

test("common punctuation counts as a boundary", () => {
  for (const before of ["(", "[", '"', "'", "{", ">", " ", "–", "—", "-"]) {
    assert.ok(at(`${before}@`), `"${before}@" should open`);
  }
});

test("a word character before the @ never counts as a boundary", () => {
  for (const before of ["a", "Z", "9", ".", ",", ":", "/", "_", "å"]) {
    assert.equal(at(`x${before}@`), null, `"${before}@" should not open`);
  }
});

test("the bracket form still works, for anyone who learned to type the token", () => {
  assert.deepEqual(at("Hey ["), { char: "[", from: 4, query: "" });
  assert.deepEqual(at("Hey [Na"), { char: "[", from: 4, query: "Na" });
  // No boundary rule for `[` — it is not ambiguous with anything.
  assert.deepEqual(at("x["), { char: "[", from: 1, query: "" });
});

test("a token that is already closed offers nothing to complete", () => {
  assert.equal(at("Hi [Name]"), null);
  assert.equal(at("Hey [Name], how are you"), null);
});

test("a newline ends the search, so the line above cannot leak in", () => {
  assert.equal(at("Hey @Name\nNew line"), null);
  assert.deepEqual(at("Row one\n@N"), { char: "@", from: 8, query: "N" });
});

test("prose long past a plausible field name gives up", () => {
  const long = "@" + "a".repeat(40);
  assert.equal(at(long), null, "nobody is choosing a field 40 characters in");
  assert.ok(at("@" + "a".repeat(20)), "but a long field name is still reachable");
});

test("the nearest trigger wins", () => {
  assert.deepEqual(at("@one and @two"), { char: "@", from: 9, query: "two" });
});

test("ranking puts prefix matches first and keeps field order", () => {
  // ContactName sits *before* Name on purpose: field order alone would rank it first, so the
  // prefix-beats-substring assertion below only means something with the list in this order.
  const fields = ["OrderNumber", "OrderDate", "City", "ContactName", "Name"];
  assert.deepEqual(rankFields(fields, ""), fields, "no query means everything, unreordered");
  assert.deepEqual(rankFields(fields, "order"), ["OrderNumber", "OrderDate"]);
  assert.deepEqual(rankFields(fields, "name"), ["Name", "ContactName"], "prefix before substring");
  assert.deepEqual(rankFields(fields, "NAME"), ["Name", "ContactName"], "case-insensitive");
  assert.deepEqual(rankFields(fields, "zzz"), []);
});
