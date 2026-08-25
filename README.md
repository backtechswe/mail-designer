# @backtech/mail-designer

Block-based email designer for React. Zero runtime dependencies beyond i18next, its own
table-based email HTML renderer, and themeable entirely through CSS custom properties so it
drops into any host app.

![The editor: editing a heading, dragging a block, previewing at mobile width, and the whole
chrome restyled by one theme prop](docs/media/mail-designer-demo.gif)

```tsx
import { MailDesigner, emptyDocument } from "@backtech/mail-designer";
import { toHtml } from "@backtech/mail-designer/render";
import "@backtech/mail-designer/styles.css";

const [doc, setDoc] = useState(emptyDocument());

<MailDesigner
  value={doc}
  onChange={setDoc}
  theme={{ accent: "#2f54eb", radius: 8 }}
  mergeFields={["Namn", "Ort"]}
  onUploadImage={uploadToStorage}
  locale="sv"
/>;

const { html, text } = toHtml(doc, { mergeValues: { Namn: "Anna" } });
```

## Why it renders its own HTML

Email HTML is nested tables and client-specific workarounds. MJML solves that well, but
pulling it in means a build-time dependency, a browser/Node split, and someone else's
release cadence. Here the renderer is a few hundred lines of pure string building instead:

- **One code path.** No DOM, no async, no platform branch. The same function runs in the
  browser preview and in a server-side send, so what a user approves is byte-for-byte what
  the recipient gets.
- **The output is ours.** Every Outlook conditional, every reset, every `mso-` property is
  in `src/render/html/` with a comment explaining which client needs it.
- **Guarded by golden files.** `test/fixtures/*.json` renders to `test/golden/*.html`, plus
  invariant tests that fail if a workaround disappears.

The trade-off is real and worth stating: we own the client-compatibility risk. That makes
test sends to Gmail, Apple Mail and Outlook part of the definition of done, not an optional
extra.

## Entry points

| Import | Contents |
|---|---|
| `@backtech/mail-designer` | `MailDesigner`, the document model and tree helpers, template stores, presets |
| `@backtech/mail-designer/render` | `toHtml`, `toPlainText`, merge fields, sanitiser — **no React, no DOM** |
| `@backtech/mail-designer/styles.css` | Editor stylesheet |

Import `/render` on a server. It is deliberately free of React so a Cloud Function or queue
worker can render without pulling the editor in.

## Two levels of appearance, kept apart

This is the distinction to internalise before styling anything:

- **`theme` prop** — the *editor's* chrome, so it blends into your app. Written onto the root
  element as CSS custom properties; nothing else to override.
- **`doc.settings`** — the *email's* appearance. What the recipient sees, and what the end
  user changes in the inspector.

```css
.md-root {
  --md-accent: #2f54eb;  --md-accent-contrast: #fff;
  --md-bg: #fff;         --md-bg-subtle: #f5f5f7;
  --md-border: #d9d9d9;  --md-text: #1f1f1f;
  --md-text-muted: #8c8c8c;
  --md-radius: 8px;      --md-space: 8px;
  --md-font: -apple-system, …;
}
```

Light and dark are the same tokens redefined; pass `colorScheme="light" | "dark" | "system"`.

## Blocks

`section` › `columns` (2–3, no nesting) › `heading` · `text` · `image` · `button` · `social` ·
`divider` · `spacer` · `html`

Nesting rules live in one predicate (`canInsert`), and drag-and-drop consults it to decide
which drop targets to offer — an illegal arrangement is never reachable through the UI.

### Moving blocks

Drag by the grip that appears on hover, or drop a new block straight from the palette.
Drag-and-drop is hand-rolled on pointer events — one code path for mouse, pen and touch, and
no dependency.

Everything is also reachable from the keyboard, because drag-and-drop is not:

| | |
|---|---|
| `Alt` + `↑` / `↓` | Reorder within the current container |
| `Alt` + `→` | Step into the next columns row, then across to the next column |
| `Alt` + `←` | Step back out of a column |
| `Delete` | Remove the selected block |

Merge fields are `[Bracketed]` tokens. They survive rendering untouched and are substituted
afterwards, so one render serves a whole recipient list.
`extractMergeFields(doc)` reports every token in use — including the ones hiding in a
button's URL.

## Starting points

Six built-in presets — **Nyhetsbrev**, **Inbjudan**, **Kampanj**, **Välkomstmejl**,
**Bekräftelse**, **Tomt** — each designed as its own piece rather than one layout recoloured:
its own palette, measure and typography. A user who opens a template and finds something
worth keeping edits it; one who finds a grey skeleton starts over, and the template has cost
them time instead of saving it.

Sample photography is **hotlinked from Unsplash**, never bundled — the package stays small,
and an email has to reference remote images anyway (Gmail blocks `data:` URIs in `<img>`).
`src/presets/images.ts` holds the catalogue with a sizing helper. Photos from
[Unsplash](https://unsplash.com), free to use under the Unsplash License.

Pass `presets` to replace or extend the list.

## Templates

Drop `<TemplateMenu store={…} />` into `toolbarExtra` for a ready-made picker. `remove` on
the store is optional and the delete button follows it, so a read-only catalogue of company
templates renders correctly rather than showing a button that cannot work.

The package ships **no database**. It defines a `TemplateStore` contract and provides the
adapters that need no dependencies — memory, `localStorage`, and a REST client that bridges
to any backend. See **[docs/templates.md](./docs/templates.md)** for the contract, the HTTP
spec, and a ready-to-paste Firestore adapter.

## Other languages

`schema/mail-document.v1.json` plus `test/fixtures/` and `test/golden/` are the complete
specification. A renderer in another language is correct exactly when it turns those
fixtures into those files. See **[docs/backend-dotnet.md](./docs/backend-dotnet.md)** for
whether a .NET port is worth it at all (usually it is not — serve the REST contract instead).

## Development

```bash
npm install
npm run dev        # examples/playground on :7788
npm run typecheck
npm test           # tsc + node --test
npm run build      # tsc -> dist/
```

```bash
UPDATE_GOLDEN=1 npm test   # after an intentional renderer change — then read the diff
node scripts/make-fixtures.mjs
node scripts/build-icons.mjs
```

No bundler, no test framework, no linter beyond `tsc --strict`. Vite and React live in
`examples/playground/package.json` so the published package's manifest stays clean.

## Icons

Icons are Font Awesome paths vendored into a generated `src/editor/icons.tsx`. The generator
only accepts icons Font Awesome's own metadata marks as free (CC BY 4.0) and fails on a
Pro-only one, so the package carries nothing that cannot be redistributed.

Icons by [Font Awesome](https://fontawesome.com), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
