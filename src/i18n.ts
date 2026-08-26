import i18next from "i18next";
import type { i18n as I18nInstance } from "i18next";
import type { Locale } from "./types.js";

/**
 * Translations, on an instance of our own.
 *
 * The one thing that matters here: `i18next.createInstance()`, never the global singleton.
 * A library that grabs the singleton fights the host app over it — double initialisation,
 * clobbered namespaces, and the editor's language flipping when the app changes its own.
 * An isolated instance under the `mailDesigner` namespace has no such interaction.
 *
 * A consumer who does not care about i18next never has to touch it: pass `locale` for one
 * of the built-in languages, or `strings` to override individual labels.
 */

import { en } from "./locales/en.js";
import { sv } from "./locales/sv.js";

export { en, sv };

export type { StringKey } from "./locales/en.js";
export type { Locale as LocaleStrings } from "./locales/en.js";
type StringKeyLocal = keyof typeof en;

/**
 * A partial override, or a whole locale.
 *
 * The same prop serves both, which is what makes a separately-shipped language one import and
 * no new API: `strings={de}` is a complete resource, `strings={{ "field.width": "Breite" }}`
 * is one label. Anything missing falls back to English.
 */
export type Strings = Partial<Record<StringKeyLocal, string>>;
export type Translate = (key: StringKeyLocal, vars?: Record<string, string | number>) => string;

const NAMESPACE = "mailDesigner";

/**
 * i18next prints a promotional line about Locize to the console on first init in a
 * development build. That is the vendor's choice to make in an application; it is not ours
 * to make in someone else's console, on their behalf, because they installed a mail editor.
 * The flag is i18next's own documented opt-out.
 */
function silenceVendorNotice(): void {
  const scope = globalThis as Record<string, unknown>;
  scope["__i18next_supportNoticeShown"] = true;
}

export function createI18n(locale: Locale, overrides?: Strings): I18nInstance {
  silenceVendorNotice();
  const instance = i18next.createInstance();
  // initImmediate: false keeps init synchronous, so the first render already has strings
  // and nothing flashes an untranslated key.
  void instance.init({
    lng: locale,
    fallbackLng: "en",
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    // Our keys contain dots ("field.width"); without this i18next would read them as nesting.
    keySeparator: false,
    nsSeparator: false,
    initImmediate: false,
    /*
     * The requested locale is registered whatever it is, with English underneath.
     *
     * That is what makes a separately-shipped language work without a new prop: pass
     * `locale="de"` and `strings={de}` and this builds a complete German resource. It also
     * means a *partial* `strings` behaves the same way it always did — anything it leaves out
     * comes from English rather than showing a key name.
     *
     * The previous form only ever registered sv and en, so `locale="de"` fell back to English
     * and the German resource handed in was never read at all.
     */
    resources: {
      en: { [NAMESPACE]: en },
      sv: { [NAMESPACE]: sv },
      [locale]: {
        [NAMESPACE]: { ...(locale === "sv" ? sv : en), ...(overrides ?? {}) },
      },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

export function createTranslate(instance: I18nInstance): Translate {
  return (key, vars) => instance.t(key, vars ?? {}) as string;
}
