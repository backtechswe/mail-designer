import { useMemo, useState } from "react";
import {
  MailDesigner,
  TemplateMenu,
  builtInPresets,
  createLocalStorageTemplateStore,
  emptyDocument,
  extractDataFields,
} from "@backtech/mail-designer";
import type {
  ColorScheme,
  DesignerTheme,
  Locale,
  MailDocument,
  Permissions,
} from "@backtech/mail-designer";

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

/**
 * Two profiles, to exercise the permission model from both ends. "Booksmart" is the locked
 * case: the application owns the copy and the data, the user arranges the layout.
 */
const PROFILES: { id: string; label: string; permissions?: Permissions; data?: Record<string, string> }[] = [
  { id: "full", label: "Full åtkomst" },
  {
    id: "booksmart",
    label: "Booksmart (låst)",
    permissions: {
      content: false,
      data: "readonly",
      manageDocuments: false,
      templates: false,
      blocks: ["text", "heading", "image", "divider", "spacer", "columns"],
      requiredFields: ["Namn", "Datum", "Tid"],
    },
    data: { Namn: "Anna Lind", Datum: "14 april", Tid: "10.30", Plats: "Storgatan 12" },
  },
];

export function App() {
  const [doc, setDoc] = useState<MailDocument>(() => builtInPresets[0]!.document);
  const [depth, setDepth] = useState(0);
  const [profileId, setProfileId] = useState("full");
  const [data, setData] = useState<Record<string, string>>({
    Namn: "Anna Lind",
    Ort: "Kalmar",
    Datum: "14 april",
  });
  const [themeId, setThemeId] = useState("default");
  const [locale, setLocale] = useState<Locale>("sv");

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0]!;
  // The editor derives the insertable fields itself now, from the data plus whatever the
  // document already refers to. This is only for the status line.
  const usedInDoc = useMemo(() => extractDataFields(doc), [doc]);

  return (
    <div className="pg">
      <div className="pg-bar">
        <strong>mail-designer</strong>

        <label>
          Profil
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

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
        <span className="pg-note">Fält i mejlet: {usedInDoc.join(", ") || "inga"}</span>
      </div>

      <div className="pg-editor">
        <MailDesigner
          value={doc}
          onChange={setDoc}
          theme={active.theme}
          colorScheme={active.scheme}
          locale={locale}
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
          data={profile.data ?? data}
          {...(profile.data ? {} : { onDataChange: setData })}
          {...(profile.permissions ? { permissions: profile.permissions } : {})}
          resetTo={builtInPresets[0]!.document}
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
