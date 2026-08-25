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
  dataFields={["Namn", "Ort"]}
  onUploadImage={uploadToStorage}
  previewIdentity={{ name: "Klubben", email: "utskick@klubben.se" }}
  locale="sv"
/>;

const { html, text } = toHtml(doc, { data: { Namn: "Anna" } });
```

## Email client compatibility

The renderer targets both current clients and Outlook's Word engine, and every workaround is
commented at the line that makes it and guarded by a test. **[docs/email-compatibility.md](./docs/email-compatibility.md)**
is the full account: what is done and why, what degrades and to what, and what cannot be
guaranteed without sending real test mail.

The short version: everything visual is inline, layout is tables, the content column is fluid
with a ghost table for Outlook, line heights are in px with `mso-line-height-rule`, and
progressive enhancements — mobile padding, stacked columns, rounded buttons — always have the
desktop value as their fallback.

`inspectEmail(doc, result)` reports what a preview cannot show, and the editor shows it above
the preview: a mail past Gmail's ~102 kB clipping limit, a `data:` image Gmail will refuse, a
section background Outlook will drop, images with no alt text, a missing preheader.

### Mobile-specific padding

Any block or section can carry `mobilePadding`, used instead of `padding` on narrow screens.
It is delivered by the media query in `<style>`, which makes it a progressive enhancement:
Outlook for desktop ignores it by design, and a few clients strip `<style>` altogether. **The
desktop value therefore has to be the one that works** — the mobile value only makes it
tighter. One CSS rule is emitted per distinct value, so thirty blocks sharing a padding share
a class.

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

`section` › `columns` (2–6, no nesting) › `heading` · `text` · `image` · `button` · `social` ·
`divider` · `spacer` · `html`

Columns behave like a table row: give one an explicit percentage and it keeps it, leave the
rest blank and they share what is left — so *"sidebar at 30%, the others split the remainder"*
is one number rather than three. The inspector shows the resulting width of every column as a
placeholder, warns when explicit widths add up to more than 100, and offers one click back to
equal. The renderer always emits a row that totals exactly 100% whatever it is handed, because
Outlook would push an over-wide column out of the mail rather than wrapping it.

Nesting rules live in one predicate (`canInsert`), and drag-and-drop consults it to decide
which drop targets to offer — an illegal arrangement is never reachable through the UI.

### Data fields

Text can carry `[Bracketed]` tokens — a **data field** — replaced per recipient at send time.
The panel below the editor holds sample values so the preview shows a real recipient's mail,
in two representations that mirror each other live:

- **Fields**, for filling in four values by hand.
- **JSON**, for pasting a payload from a real request.

Neither is a mode you switch into. Add a key on either side and it appears on the other, and
becomes insertable into the email — so the data and the available fields cannot drift apart.

**Inserting a field**: type `@` while writing and a filtered list appears at the caret, each row
showing the field's current sample value — arrows and Enter, no mouse. `@` because that is the
gesture people already know from Slack, Notion, Teams and Google Docs; `[` works too, for
anyone who has learned to type the token by hand. A labelled **Datafält** button opens the same
list, and exists to teach the gesture rather than to replace it.

Email addresses do not trigger it. The rule every app doing this settles on is that `@` only
counts **after a word boundary**: in `niklas@ninetech.com` it follows `s`, so nothing opens; in
`Hej @` it follows a space, so it does. A second `@` inside the query closes it again, and the
list only opens when something actually matches — so a query that turns out to be prose
disappears rather than hanging around empty. `findTrigger` is pure and has twelve tests,
because an off-by-one here pops a menu over someone's address as they type it.

A right-click menu was considered and rejected: nobody discovers a feature by right-clicking,
and inside a text field the browser's own context menu is where people go for spellcheck and
paste, so overriding it costs more than it gives. The caret is already the insertion point.

**Coverage is checked both ways.** A field supplied but not shown anywhere is reported, and so
is a token the data has no value for. That check is the point of the panel: if the application
supplies `Datum` and the user deletes the block containing `[Datum]`, nothing throws and
nothing looks broken — the recipient just gets a confirmation with the date missing. List the
ones that must never disappear in `permissions.requiredFields` and the editor says so loudly.

```tsx
const { used, unused, withoutValue, missingRequired } = dataCoverage(doc, data, ["Datum"]);
```

Sample data is deliberately **not** part of the document: it is what you design against, while
the real values arrive per recipient. Persist it in the template's `meta` if you want it back
next time.

### Permissions

Everything defaults to permitted. Restrict what a particular integration allows:

```tsx
// The application owns the copy and the data; the user arranges the layout.
<MailDesigner
  permissions={{
    content: false,
    data: "readonly",
    templates: false,
    manageDocuments: false,
    blocks: ["heading", "text", "image", "columns", "divider", "spacer"],
    requiredFields: ["Namn", "Datum", "Tid"],
  }}
  data={{ Namn: "Anna Lind", Datum: "14 april", Tid: "10.30" }}
  resetTo={confirmationTemplate}
/>
```

| | |
|---|---|
| `structure` | Add, remove, duplicate and move blocks |
| `content` | The words and pictures: text, image sources, links, button labels |
| `appearance` | Colours, fonts, sizes, spacing, alignment |
| `mailSettings` | The email-wide settings tab |
| `data` | `"edit"` · `"readonly"` · `"hidden"` |
| `blocks` | Which types the palette offers |
| `requiredFields` | Fields that must appear somewhere in the email |
| `manageDocuments` | Whether the user may create and delete documents |
| `history`, `templates` | Show those controls |

Few knobs on purpose, each one something a product decision actually sounds like — *"they can
rearrange it but not rewrite the words"*. A config with forty flags is one nobody configures
correctly.

**Which** documents exist is the store's business: return two from `list()` and those are the
two. `manageDocuments: false` then stops the user adding or removing any. Give `resetTo` a
document and the bar offers a one-click way back to it — an edit, so it can be undone.

#### Locking individual blocks

Some blocks should be fixed even when the rest is not — a legal footer, a logo, the line
carrying `[Datum]`. That lock lives on the block, in the document, because a prop cannot say
"this block, not that one":

```ts
{ id: "footer", type: "text", html: "…", locked: true }
{ id: "date", type: "text", html: "[Datum]", locked: { content: true, remove: true } }
```

A lock can only take away. A locked block in a fully editable document is still locked, and an
unlocked block in a read-only document is still read-only. Locked blocks show a padlock, offer
no actions they cannot perform, and cannot be dragged — so nothing appears to work and then
quietly doesn't.

### Document session

Hand the editor a `TemplateStore` and it manages the document itself:

```tsx
<MailDesigner value={doc} onChange={setDoc} store={store} autosaveMs={1200} />
```

That adds a strip above the toolbar with the document name, the save state, and a switcher —
so you can move between documents without leaving the editor. Two rules shape it:

- **The record is created on the first edit**, not on load. There is something to save
  changes against as soon as the user starts working, without filling the store with empty
  drafts every time the editor is opened. Unnamed drafts get a dated name, because a list of
  drafts is only useful if you can tell them apart.
- **Switching documents clears the undo history.** Applying a template edits the document you
  are on, so it belongs in the history; switching does not. Undoing across a switch would
  pull the previous document's content into the new record, and autosave would write it there.

Autosave narrows the unsaved window but does not close it — a save can be in flight, or have
failed — so the editor asks before a step that could lose work: switching document, starting
a new one, applying a template over existing content, deleting a document. Each prompt says
what will happen, and where it is true, that it can be undone. It never asks when there is
nothing to lose.

Prompts use an in-page dialog, not `window.confirm`: that blocks the page, cannot be
translated, and in an embedded editor it looks like the host application broke.

### History

Undo and redo are global: one stack covering every change the editor makes — typing, styling,
moving, adding, deleting, email settings, applying a template — plus documents the host swaps
in from its own chrome, which are recorded as a step rather than discarding what came before.

The controls sit apart from the view and viewport toggles, because history acts on the whole
document and a button grouped with the preview toggle reads as belonging to the preview. Two
standalone buttons, spaced but not boxed: boxing them implies a group, and undo and redo are
not one — neither is a state, and one is not an alternative to the other.

**Resting on either button opens the last ten steps.** Picking one takes every step down to
it, so going back six changes is one gesture rather than six clicks, and hovering a line
highlights every line above it too — otherwise picking the sixth line looks like it undoes one
thing. Steps are named after what they touched (*Added Image*, *Moved Button*), which is what
makes the list worth reading; a menu of six identical "Added a block" lines would not be.
`ArrowDown` opens the menu from the keyboard, `Escape` closes it.

| | |
|---|---|
| `Cmd`/`Ctrl` + `Z` | Undo |
| `Shift` + `Cmd`/`Ctrl` + `Z`, or `Ctrl` + `Y` | Redo |
| `Cmd`/`Ctrl` + `S` | Save now |
| `Cmd`/`Ctrl` + `D` | Duplicate the selected block |
| `Cmd`/`Ctrl` + `E` | Toggle preview |
| `Delete` | Delete the selected block |
| `Esc` | Select what surrounds the block; again to deselect |
| `Alt` + `↑` `↓` | Move the block |
| `Alt` + `←` `→` | Move into or out of a column |
| `?` | Show this list |

`?` opens a panel listing all of them. Shortcuts people cannot discover are shortcuts nobody
uses, and a keyboard-first editor that hides its own keyboard is a contradiction.

The shortcut is captured at the editor root. That beats the browser's own contenteditable
undo — which would otherwise restore DOM text the document model knows nothing about, and the
two histories would drift apart within a few keystrokes — while keeping the shortcut scoped to
the editor rather than the whole host application.

200 steps are kept. Consecutive changes to the same property of the same block merge into one
step; the run ends when you leave the field, select another block, touch another property, or
undo. Time is only a 30-second backstop — it started out as the primary rule with a 600 ms
window, and that was wrong: on a heavy document a render delays the next input event enough
that consecutive keystrokes arrive a second apart, and every digit became its own step.

```tsx
<MailDesigner
  historyLimit={500}
  showHistory={false}                 // render no built-in cluster
  onHistoryChange={setHistoryControls} // …and drive it from your own chrome
/>
```

`HistoryControls` carries `canUndo`, `canRedo`, `undoLabel`, `redoLabel`, `depth`,
`undoSteps`, `redoSteps`, `undo(count?)` and `redo(count?)` — the step lists are what a host
needs to build its own version of the menu.

### Two levels of settings

The inspector has two tabs, and the relationship between them is the thing to understand:

- **Mejlet / Email** — defaults for the whole message: width, font, sizes, colours, preheader.
- **Block** — the selected block's own values, which override the defaults.

Every overridable field says which state it is in — a quiet *Inherited*, or a *Custom* chip
that clears the override when clicked — and an empty field shows the inherited value as its
placeholder rather than the word "Auto". Where blocks are ignoring a global setting, the
Email tab names how many and offers to make them all follow it again. Without that, changing
a global font and watching half the mail stay put reads as a bug rather than as blocks doing
exactly what they were told.

### Reaching a block another block covers

A section whose only child is an edge-to-edge image has no pixel that belongs to the section
rather than the image — no amount of careful aiming reaches it. Two ways out, both independent
of where you click:

- The **breadcrumb** at the top of the Block tab shows the chain around the selection —
  *Section › Columns › Text* — and every step in it is clickable.
- **`Esc`** steps out one level, and again to deselect. "Zoom out" is more often what is wanted
  than "clear the selection".

`ancestorsOf(doc, id)` and `parentOf(doc, id)` expose the same chain to a host app.

### Three viewports, and the client around them

`Desktop`, `Tablet` and `Phone`, and they work while editing, not only while previewing. The
canvas stacks columns on the same rule the emitted CSS uses (`viewportWidth <
settings.width - 20`) rather than on the name of the viewport, so what you see while editing
and what the media query actually does cannot drift apart.

The frame toggle puts the preview inside a device running a mail client — drawn in CSS, no
images, no dependency, no manufacturer's product, but at real geometry:

| | Screen | The mail gets | Taken by the client |
|---|---|---|---|
| Desktop | 1180 × 720 window | 672 | folder list 212, message list 296 |
| Tablet | 820 × 1180 (iPad Air 11" portrait) | 820 | status bar, nav bar |
| Phone | 393 × 852 (iPhone 16 portrait) | 393 | status bar 54, nav bar 44, toolbar 68 |

Three things follow from doing it properly rather than drawing a rounded rectangle:

**The mail is never full-screen, because it never is.** About 180 of a phone's 852 points are
gone before the body starts, and on a desktop the reading pane is little more than half the
window. That is the difference between a preview that shows the mail and one that shows what
the recipient sees.

**The frame is scaled, not resized.** The mail inside still renders at the device's true
content width, so its media queries fire exactly as they would on the device. Rendering a
phone at whatever width happened to fit would quietly change which breakpoints apply, and the
preview would be lying about the one thing it exists to be right about.

**The message list shows the preheader.** It is the only place an editor can show what a
preheader is *for* — and when there is none, the mock shows the fallback the client would use
instead, marked, which is very often "View this email in your browser". `messageSummary(doc)`
is the pure function behind it.

The sender line comes from `previewIdentity`; it is editor chrome and is never rendered into
the mail. The client's own colours are `--md-client-*` and stay light whatever the editor's
colour scheme, because a reference that changes with its surroundings is not one.

| | |
|---|---|
| `1` / `2` / `3` | Desktop, tablet, phone |
| `M` | Show or hide the device frame (switches to preview, where it means something) |

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
`extractDataFields(doc)` reports every token in use — including the ones hiding in a
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
