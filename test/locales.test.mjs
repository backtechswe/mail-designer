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
