import { useMemo, useState } from "react";
import {
  MailDesigner,
  TemplateMenu,
  builtInPresets,
  createLocalStorageTemplateStore,
  emptyDocument,
  extractMergeFields,
} from "@backtech/mail-designer";
import type { ColorScheme, DesignerTheme, Locale, MailDocument } from "@backtech/mail-designer";

/**
 * Playground. Not part of the package — it exists to exercise the editor and, in
 * particular, to prove the theming claim: switching the preset below must restyle the whole
 * editor without a single hard-coded colour leaking through.
 */

const THEMES: { id: string; label: string; theme?: DesignerTheme; scheme: ColorScheme }[] = [
  { id: "default", label: "Standard", scheme: "light" },
  {
    id: "plum",
    label: "Plommon",
    scheme: "light",
    theme: {
      accent: "#7b2fbe",
      accentContrast: "#fff",
      accentSoft: "#f2e9fa",
      radius: 0,
      bgSubtle: "#f7f3fb",
      bgSunken: "#e6dcef",
      borderStrong: "#b79ccd",
    },
  },
  {
    id: "forest",
    label: "Skog",
    scheme: "light",
    theme: {
      accent: "#1f7a4d",
      accentContrast: "#fff",
      accentSoft: "#e6f2eb",
      radius: 16,
      bgSunken: "#dde9e1",
      fontFamily: "Georgia, 'Times New Roman', serif",
    },
  },
  { id: "dark", label: "Mörkt", scheme: "dark" },
  { id: "system", label: "System", scheme: "system" },
];

const store = createLocalStorageTemplateStore({ key: "mail-designer:playground" });

export function App() {
  const [doc, setDoc] = useState<MailDocument>(() => builtInPresets[0]!.document);
  const [depth, setDepth] = useState(0);
  const [themeId, setThemeId] = useState("default");
  const [locale, setLocale] = useState<Locale>("sv");

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const mergeFields = useMemo(() => {
    // Union of what the document already uses and a fixed demo list, so the insert menu
    // has something to offer on a blank document too.
    const used = extractMergeFields(doc);
    return [...new Set([...used, "Namn", "Ort", "Datum"])];
  }, [doc]);

  return (
    <div className="pg">
      <div className="pg-bar">
        <strong>mail-designer</strong>

        <label>
          Tema
          <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Språk
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
        </label>

        {/* Replaces the document from *outside* the editor, the way a host app's own
            "new mail" button would. The editor records it as a history step rather than
            discarding what came before. */}
        <button type="button" className="pg-reset" onClick={() => setDoc(emptyDocument())}>
          Nytt mejl (utifrån)
        </button>

        <span className="pg-note">Historik: {depth} steg</span>
        <span className="pg-note">Merge-fält: {mergeFields.join(", ")}</span>
      </div>

      <div className="pg-editor">
        <MailDesigner
          value={doc}
          onChange={setDoc}
          theme={active.theme}
          colorScheme={active.scheme}
          locale={locale}
          mergeFields={mergeFields}
          // Demonstrates the upload contract without needing a backend: the file becomes a
          // data: URI. Real hosts return a hosted URL — Gmail blocks data: images.
          onUploadImage={async (file) =>
            await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Kunde inte läsa filen."));
              reader.readAsDataURL(file);
            })
          }
          resolveSocialIcon={(network) => `https://cdn.simpleicons.org/${network}`}
          onHistoryChange={(h) => setDepth(h.depth)}
          // Handing the editor a store turns on the document session: name bar, autosave,
          // switcher, and the prompts that go with them. Here it is localStorage; in Utskick
          // it will be Firestore.
          store={store}
          autosaveMs={800}
          // The menu is part of the package and speaks only the TemplateStore contract —
          // here backed by localStorage, in Utskick it will be Firestore.
          // Presets only: saved documents live in the document bar now, and offering them
          // in two places would invite opening one in a way that does not switch to it.
          toolbarExtra={<TemplateMenu />}
        />
      </div>
    </div>
  );
}
