/**
 * The shipped locales.
 *
 * A translation is the kind of thing that looks finished and then rots: a key added to the
 * editor, a placeholder renamed, a plural form forgotten. The type system catches a missing
 * key at build time; these catch the rest.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../dist/locales/en.js";
import { sv } from "../dist/locales/sv.js";
import { de } from "../dist/locales/de.js";
import { fr } from "../dist/locales/fr.js";
import { es } from "../dist/locales/es.js";
import { createI18n, createTranslate } from "../dist/i18n.js";

const LOCALES = { sv, de, fr, es };
const KEYS = Object.keys(en);
const placeholders = (value) => (String(value).match(/{{\s*\w+\s*}}/g) ?? []).sort();

test("English defines a key set worth translating", () => {
  assert.ok(KEYS.length > 200, `only ${KEYS.length} keys`);
});

for (const [name, locale] of Object.entries(LOCALES)) {
  test(`${name} has exactly the keys English has`, () => {
    assert.deepEqual(
      KEYS.filter((key) => !(key in locale)),
      [],
      "missing keys fall back to English silently, so nobody notices",
    );
    assert.deepEqual(
      Object.keys(locale).filter((key) => !KEYS.includes(key)),
      [],
      "a key nothing reads is either a typo or dead weight",
    );
  });

  test(`${name} keeps every placeholder`, () => {
    // A dropped {{count}} is a sentence with a hole in it; a renamed one prints the braces.
    for (const key of KEYS) {
      assert.deepEqual(placeholders(locale[key]), placeholders(en[key]), key);
    }
  });

  test(`${name} has both plural forms where English does`, () => {
    for (const key of KEYS.filter((k) => k.endsWith("_one"))) {
      const other = key.replace(/_one$/, "_other");
      assert.ok(other in locale, `${key} without ${other}`);
    }
  });

  test(`${name} is actually translated`, () => {
    // Some strings are legitimately identical — HTML, JSON, Auto, URL, an example address.
    const identical = KEYS.filter((key) => locale[key] === en[key] && en[key].length > 8);
    assert.ok(
      identical.length <= 3,
      `${identical.length} long strings are still English: ${identical.join(", ")}`,
    );
  });

  test(`${name} interpolates through the real i18next instance`, () => {
    const t = createTranslate(createI18n(name, locale));
    const inserted = t("history.insert", { block: t("block.image") });
    assert.doesNotMatch(inserted, /{{|}}/, "a placeholder survived into the output");
    assert.notEqual(inserted, en["history.insert"], "the locale was not applied at all");
    assert.match(t("field.columnLabel", { n: 2 }), /2/);
  });
}

test("a locale the package does not bundle still reaches the editor", () => {
  // The whole point of shipping locales as separate entries: `strings` carries the resource,
  // and createI18n registers it under whatever tag was asked for. The previous version only
  // ever registered sv and en, so this silently fell back to English.
  const t = createTranslate(createI18n("de", de));
  assert.equal(t("toolbar.edit"), de["toolbar.edit"]);
  assert.notEqual(t("toolbar.edit"), en["toolbar.edit"]);
});

test("a partial override layers on top of a full locale", () => {
  const t = createTranslate(createI18n("de", { ...de, "toolbar.edit": "Ändern" }));
  assert.equal(t("toolbar.edit"), "Ändern");
  assert.equal(t("toolbar.preview"), de["toolbar.preview"], "the rest of German survives");
});

test("a partial override with no locale still falls back to English", () => {
  const t = createTranslate(createI18n("en", { "toolbar.edit": "Compose" }));
  assert.equal(t("toolbar.edit"), "Compose");
  assert.equal(t("toolbar.preview"), en["toolbar.preview"]);
});

test("no interpolated sentence asks a participle to agree with a noun", () => {
  // French and Spanish participles agree in gender with the noun, and the block name is
  // interpolated — so "Image ajouté" and "Imagen añadido" were both wrong until the sentences
  // were rebuilt to need no agreement. Worth a guard: the shapes are easy to reintroduce.
  const shapes = [/\{\{block\}\}\s+(ajouté|supprimé|dupliqué|déplacé)/, /\{\{block\}\}\s+(añadido|eliminado|duplicado|movido)/];
  for (const [name, locale] of Object.entries({ fr, es })) {
    for (const key of KEYS) {
      for (const shape of shapes) {
        assert.doesNotMatch(String(locale[key]), shape, `${name}: ${key}`);
      }
    }
  }
});

/**
 * Two different controls must not carry the same label.
 *
 * This is the part of translation review that needs no native speaker: it is a logic error,
 * visible in any language. It found four real ones — German called both the spacer block and
 * the column gap *Abstand*, French used *marge intérieure* for a block's padding and a
 * button's inner padding in the same panel, Spanish said *Subir* for both "upload" and "move
 * up", and Swedish — the original, written first — had the spacer/gap clash too, plus one word
 * for vertical middle and horizontal centre.
 */
const SAME_THING_TWICE = [
  // The block and the field that counts them. Both are about columns; no ambiguity.
  ["block.columns", "field.columnCount"],
  // Three places that all mean the markup language.
  ["block.html", "field.html", "code.html"],
  // The panel and the button that opens it.
  ["data.panel", "data.open"],
  /*
   * French undo and French cancel are both "Annuler", which is what macOS does and what a
   * French user expects. They never appear together — one is a toolbar tooltip, the other a
   * dialog button — so the alternative would be an unusual word for a familiar action.
   */
  ["toolbar.undo", "action.cancel"],
];

const allowed = (keys) =>
  SAME_THING_TWICE.some((group) => keys.every((key) => group.includes(key)));

for (const [name, locale] of Object.entries({ en, ...LOCALES })) {
  test(`${name} gives two different controls two different names`, () => {
    // Short strings only: a control's name, where a duplicate is a genuine ambiguity, rather
    // than two hints that happen to share a sentence.
    const labels = Object.entries(locale).filter(
      ([key, value]) => value.length <= 22 && /^(block|field|align|toolbar|action|data|code)\./.test(key),
    );
    const byValue = new Map();
    for (const [key, value] of labels) {
      const seen = byValue.get(value.toLowerCase()) ?? [];
      byValue.set(value.toLowerCase(), [...seen, key]);
    }
    const clashes = [...byValue.entries()]
      .filter(([, keys]) => keys.length > 1 && !allowed(keys))
      .map(([value, keys]) => `"${value}" is both ${keys.join(" and ")}`);
    assert.deepEqual(clashes, [], clashes.join("; "));
  });
}
