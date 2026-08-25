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
  assert.deepEqual(at("Hej @"), { char: "@", from: 4, query: "" });
  assert.deepEqual(at("Hej @na"), { char: "@", from: 4, query: "na" });
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
  assert.equal(at("kontakt.oss@exempel"), null);
});

test("an address after a legitimate trigger closes it again", () => {
  // "Hej @" opens, then the user turns out to be typing an address after all.
  assert.deepEqual(at("Hej @niklas"), { char: "@", from: 4, query: "niklas" });
  assert.equal(at("Hej @niklas@ninetech.com"), null, "a second @ means an address");
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
  assert.deepEqual(at("Hej ["), { char: "[", from: 4, query: "" });
  assert.deepEqual(at("Hej [Na"), { char: "[", from: 4, query: "Na" });
  // No boundary rule for `[` — it is not ambiguous with anything.
  assert.deepEqual(at("x["), { char: "[", from: 1, query: "" });
});

test("a token that is already closed offers nothing to complete", () => {
  assert.equal(at("Hej [Namn]"), null);
  assert.equal(at("Hej [Namn], hur är det"), null);
});

test("a newline ends the search, so the line above cannot leak in", () => {
  assert.equal(at("Hej @Namn\nNy rad"), null);
  assert.deepEqual(at("Rad ett\n@N"), { char: "@", from: 8, query: "N" });
});

test("prose long past a plausible field name gives up", () => {
  const long = "@" + "a".repeat(40);
  assert.equal(at(long), null, "nobody is choosing a field 40 characters in");
  assert.ok(at("@" + "a".repeat(20)), "but a long field name is still reachable");
});

test("the nearest trigger wins", () => {
  assert.deepEqual(at("@ett och @två"), { char: "@", from: 9, query: "två" });
});

test("ranking puts prefix matches first and keeps field order", () => {
  const fields = ["Ort", "Datum", "Namn", "Ordernummer", "Kontaktnamn"];
  assert.deepEqual(rankFields(fields, ""), fields, "no query means everything, unreordered");
  assert.deepEqual(rankFields(fields, "or"), ["Ort", "Ordernummer"]);
  assert.deepEqual(rankFields(fields, "namn"), ["Namn", "Kontaktnamn"], "prefix before substring");
  assert.deepEqual(rankFields(fields, "NAMN"), ["Namn", "Kontaktnamn"], "case-insensitive");
  assert.deepEqual(rankFields(fields, "zzz"), []);
});
