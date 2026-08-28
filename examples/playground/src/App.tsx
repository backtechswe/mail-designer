import { useMemo, useState } from "react";
import { de } from "@backtech/mail-designer/locales/de";
import { fr } from "@backtech/mail-designer/locales/fr";
import { es } from "@backtech/mail-designer/locales/es";
import { sv } from "@backtech/mail-designer/locales/sv";

/**
 * Only English is in the package's main bundle; the rest are separate entries you import.
 * This map is what a host app writes — four imports and a lookup.
 */
const LOCALES: Record<string, Record<string, string> | undefined> = { en: undefined, sv, de, fr, es };

/** Stands in for a host's own icon set — see the `customise.icons` prop below. */
function DemoTrashIcon({ size = 16 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, display: "block" }} aria-hidden>
      ✕
    </span>
  );
}
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
    label: "Plum",
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
    label: "Forest",
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
  { id: "dark", label: "Dark", scheme: "dark" },
  { id: "system", label: "System", scheme: "system" },
];

const store = createLocalStorageTemplateStore({ key: "mail-designer:playground" });

/**
 * Two profiles, to exercise the permission model from both ends. The locked one is the case
 * the model exists for: the application owns the copy and the data, the user arranges the
 * layout and nothing else.
 */
const PROFILES: { id: string; label: string; permissions?: Permissions; data?: Record<string, string> }[] = [
  { id: "full", label: "Full access" },
  {
    id: "locked",
    label: "Locked content",
    permissions: {
      content: false,
      data: "readonly",
      manageDocuments: false,
      templates: false,
      blocks: ["text", "heading", "image", "divider", "spacer", "columns"],
      requiredFields: ["Name", "Date", "Time"],
    },
    data: { Name: "Robin Alvarez", Date: "14 April", Time: "10:30", Where: "12 Example Street" },
  },
];

export function App() {
  const [doc, setDoc] = useState<MailDocument>(() => builtInPresets[0]!.document);
  const [depth, setDepth] = useState(0);
  const [profileId, setProfileId] = useState("full");
  const [data, setData] = useState<Record<string, string>>({
    Name: "Robin Alvarez",
    City: "Exampleton",
    Date: "14 April",
  });
  const [themeId, setThemeId] = useState("default");
  const [locale, setLocale] = useState<Locale>("en");
  const [customised, setCustomised] = useState(false);

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0]!;
  // The editor derives the insertable fields itself now, from the data plus whatever the
  // document already refers to. This is only for the status line.
  const usedInDoc = useMemo(() => extractDataFields(doc), [doc]);

  return (
    <div className="pg">
      <header className="pg-bar">
        <div className="pg-id">
          <strong>@backtech/mail-designer</strong>
          <span>
            A block editor for email, with its own renderer. This page runs the package itself —
            everything you change here goes through the same code an application would import.
          </span>
        </div>

        {/*
          Each control names the prop it drives. Without that this row is a set of unexplained
          switches; with it, the demo is a tour of the API.
        */}
        <div className="pg-controls">
          <label>
            <em>permissions</em>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <em>theme</em>
            <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <em>locale</em>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="sv">Svenska</option>
            </select>
          </label>

          <label className="pg-field">
            <em>customise</em>
            <span>
              <input
                type="checkbox"
                checked={customised}
                onChange={(e) => setCustomised(e.target.checked)}
              />
              own classes
            </span>
          </label>

          {/* Replaces the document from *outside* the editor, the way a host app's own
              "new mail" button would. The editor records it as a history step rather than
              discarding what came before. */}
          <button type="button" className="pg-reset" onClick={() => setDoc(emptyDocument())}>
            Replace from outside
          </button>
        </div>

        <nav className="pg-links">
          <a href="https://github.com/backtechswe/mail-designer">GitHub</a>
          <a href="https://www.npmjs.com/package/@backtech/mail-designer">npm</a>
        </nav>
      </header>

      <p className="pg-hint">
        Worth a look: <strong>Code</strong> shows the HTML it produces, the device frame in
        <strong> Preview</strong> puts it inside a mail client, and <em>permissions</em> above
        switches to a profile where the application owns the copy and the reader only arranges
        the layout. History: {depth} steps · fields used: {usedInDoc.join(", ") || "none"}
      </p>

      <p className="pg-narrow">
        The editor wants about 900px. On a phone it collapses to one column and the canvas
        scrolls, but it is not built for a small screen and this page is not the place to
        pretend otherwise.
      </p>

      <div className="pg-editor">
        <MailDesigner
          value={doc}
          onChange={setDoc}
          theme={active.theme}
          colorScheme={active.scheme}
          locale={locale}
          {...(LOCALES[locale] ? { strings: LOCALES[locale] } : {})}
          // Demonstrates the upload contract without needing a backend: the file becomes a
          // data: URI. Real hosts return a hosted URL — Gmail blocks data: images.
          onUploadImage={async (file) =>
            await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Could not read the file."));
              reader.readAsDataURL(file);
            })
          }
          resolveSocialIcon={(network) => `https://cdn.simpleicons.org/${network}`}
          // Shown only in the device mock's sender line — never rendered into the mail.
          previewIdentity={{ name: "The Newsletter", email: "mail@example.com" }}
          // Demonstrates the customise surface. A real host would put its own design system's
          // classes here; the playground defines .demo-* in index.css so the effect is visible
          // without pulling in Tailwind.
          {...(customised
            ? {
                customise: {
                  classNames: {
                    toolbar: "demo-toolbar",
                    button: "demo-button",
                    buttonActive: "demo-button-active",
                    panel: "demo-panel",
                    input: "demo-input",
                    label: "demo-label",
                  },
                  icons: { trash: DemoTrashIcon },
                },
              }
            : {})}
          onHistoryChange={(h) => setDepth(h.depth)}
          // Handing the editor a store turns on the document session: name bar, autosave,
          // switcher, and the prompts that go with them. Here it is localStorage; a real host
          // it will be Firestore.
          store={store}
          autosaveMs={800}
          data={profile.data ?? data}
          {...(profile.data ? {} : { onDataChange: setData })}
          {...(profile.permissions ? { permissions: profile.permissions } : {})}
          resetTo={builtInPresets[0]!.document}
          // The menu is part of the package and speaks only the TemplateStore contract —
          // here backed by localStorage; a real host would use its own database.
          // Presets only: saved documents live in the document bar now, and offering them
          // in two places would invite opening one in a way that does not switch to it.
          toolbarExtra={<TemplateMenu />}
        />
      </div>
    </div>
  );
}
