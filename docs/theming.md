# Making it look like your application

Three mechanisms, in the order you will reach for them. None of them adds a dependency, and
none of them requires `!important`.

## 1. Tokens — the whole palette in fifteen values

The editor's chrome is drawn entirely from CSS custom properties. The `theme` prop writes them
as inline custom properties on the root element, so nothing has to be recompiled:

```tsx
<MailDesigner theme={{ accent: "#f97316", radius: 12, font: "Inter, sans-serif" }} />
```

| Token | What it colours |
|---|---|
| `--md-accent`, `--md-accent-contrast`, `--md-accent-soft` | selection, active states, focus ring |
| `--md-bg`, `--md-bg-subtle`, `--md-bg-sunken` | surfaces, from raised to recessed |
| `--md-border`, `--md-border-strong` | field and panel edges |
| `--md-text`, `--md-text-muted` | copy and labels |
| `--md-danger` | destructive actions |
| `--md-radius`, `--md-radius-sm`, `--md-space` | shape and rhythm |
| `--md-font`, `--md-font-mono` | the editor's own type |
| `--md-lift` | the shadow on anything raised |

Light and dark come from `prefers-color-scheme`, overridable with
`colorScheme="light" | "dark" | "system"`. The root also declares `color-scheme`, so scrollbars,
spinners and the native colour picker follow.

These are the editor's chrome. The *email's* appearance lives in `value.settings` and belongs to
the person writing the mail — see the README on why those are deliberately separate.

## 2. `classNames` — your own classes on named parts

For anything tokens do not reach, attach your classes to a part. This is where Tailwind's
utilities go:

```tsx
<MailDesigner
  customise={{
    classNames: {
      toolbar: "bg-slate-900 border-slate-800",
      button: "rounded-full font-semibold",
      buttonActive: "bg-orange-500 text-slate-900",
      panel: "rounded-2xl shadow-2xl",
      input: "rounded-lg bg-slate-50",
      label: "uppercase tracking-widest text-[9px] text-orange-500",
    },
  }}
/>
```

| Slot | Element |
|---|---|
| `root` | the editor's outermost element |
| `toolbar` | the strip above the panels |
| `documentBar` | the name and save row, when a `store` is given |
| `palette` | the block list on the left |
| `canvas` | the scrolling canvas |
| `inspector` | the properties column |
| `panel` | any raised surface: dropdown, history menu, dialog |
| `button` | the editor's chrome buttons — toolbar, palette, menus |
| `buttonActive` | added to a button in its chosen state |
| `input`, `select` | form controls in the inspector |
| `field`, `label` | a field's wrapper and its label |

**Why your class wins.** Every rule in `styles.css` that backs one of these slots is wrapped in
`:where()`, which contributes no specificity at all. `.md-toolbar` and your `.my-toolbar` are
both one class deep, so without that the winner would be decided by import order — and a host
that imports our stylesheet after its own would silently lose every override. At zero weight
yours always wins, whichever order the bundler happens to pick.

The same property is why nothing here needs `!important`, and why a Tailwind utility class works
as-is rather than needing `@apply` or a `!` prefix.

There is deliberately no slot for every element, and no way to replace whole panels. Both would
turn the editor's internals into a public contract; a class map plus tokens covers what a design
system actually owns — its colours, its type, its shape.

## 3. `icons` — your own glyphs

```tsx
<MailDesigner customise={{ icons: { trash: MyTrashIcon, image: MyImageIcon } }} />
```

Anything omitted keeps the built-in icon, so you can replace one or all sixty-two. A replacement
receives `size` and `className` and should render at the size it is given. Names come from
`IconName`, which is exported.

## Your CSS cannot reach in, and ours cannot reach out

Two things worth knowing about an editor embedded in someone else's page:

**Nothing leaks out.** Every selector in `styles.css` is scoped under `.md-root`. There are no
global rules, no element selectors outside that scope, and no resets applied to your page.

**Nothing leaks in.** There is a reset scoped to `.md-root` covering the elements a global
stylesheet is likely to touch — `button`, form controls, headings, lists, tables, links, images,
labels. Without it, a host rule like `button { text-transform: uppercase }` — or Tailwind's
Preflight, which is that and more — would reach every button in the editor. The reset is also
weightless, so it beats a bare element selector from your stylesheet and loses to every one of
your classes.

## It sizes to its own box

Layout responds to the editor's width, not the window's: `container: md-editor / inline-size` on
the root, and `@container` queries below. An editor in a 700px panel on a 1600px page collapses
to a single column, which a `@media` query would have got wrong.
