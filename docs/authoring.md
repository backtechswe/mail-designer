# Writing a document by hand

A mail-designer template *is* a JSON document — the editor is one way to produce one, and not
the only one. This is what you need to write a valid one without opening a browser: a script,
a backend, or an agent asked for "a template for the spring newsletter".

Everything here is enforced by `validateDocument`, and everything the renderer will *not* fix
for you is called out. Verify with:

```bash
npx @backtech/mail-designer check draft.json      # structure, size, and what will look wrong
npx @backtech/mail-designer render draft.json --pretty > mail.html
```

**Start from a preset.** `mail-designer new newsletter --out draft.json` writes a worked
example of every convention below. Modifying one is far more reliable than writing from
nothing, and the presets are the same documents the editor ships with.

## Shape

```jsonc
{
  "version": 1,
  "settings": { … },      // defaults for the whole mail
  "blocks": [ … ]         // sections, always — the top level holds nothing else
}
```

`settings` — every field optional, sensible defaults applied:

| | | |
|---|---|---|
| `width` | number | Content width in px. 600–640 is the safe range. |
| `backgroundColor` | colour | The page behind the mail. |
| `contentBackgroundColor` | colour | The mail's own surface. |
| `fontFamily` | string | A full CSS stack. Web fonts do not load in most clients. |
| `fontSize`, `lineHeight` | number | Base size in px; line height as a multiplier. |
| `textColor`, `linkColor` | colour | Links need their own, or Gmail paints them blue. |
| `preheader` | string | The line the inbox shows after the subject. Set it. |

## Blocks

Every block needs a unique `id` (any string) and a `type`. Optional on all of them:
`padding: [top, right, bottom, left]` in px, `mobilePadding` (same shape, used below 620px),
and `locked`.

**The top level is sections.** A section holds leaves or columns; a column holds leaves.

```jsonc
{ "id": "s1", "type": "section", "children": [ … ],
  "backgroundColor": "#fff", "fullWidth": false }
```

```jsonc
{ "id": "c1", "type": "columns", "gap": 24, "stackOnMobile": true,
  "columns": [ { "id": "c1a", "children": [ … ], "width": 60 },
               { "id": "c1b", "children": [ … ], "width": 40 } ] }
```
`width` is a percentage and is optional — omit it on every column for equal ones. The gap is
taken out of the columns, not added around them, so the widths still total 100.

| Type | Required | Notes |
|---|---|---|
| `heading` | `level` 1–3, `html`, `align` | `html` is inline markup only: `b i em strong a br span`. |
| `text` | `html`, `align` | Wrap paragraphs in `<p>`. |
| `image` | `src`, `alt`, `align` | `src` must be a hosted URL — Gmail blocks `data:` images. `alt` is not optional in practice: images are blocked by default in Outlook. |
| `button` | `label`, `href`, `backgroundColor`, `textColor`, `borderRadius`, `fontSize`, `innerPadding`, `align` | Set `width` (px) whenever `borderRadius > 0`: Outlook cannot round a corner without the VML fallback, and the fallback needs a fixed width. |
| `divider` | `color`, `thickness`, `width`, `align` | `width` is a percentage. |
| `spacer` | `height` | px. |
| `social` | `items`, `iconSize`, `spacing`, `align` | Each item is `{ network, href, iconUrl }`; `iconUrl` must be hosted for the same reason as images. |
| `html` | `html` | Raw markup, sanitised but otherwise untouched. Use it last. |

Optional on `heading` and `text`: `color`, `fontSize`, `fontFamily`, `lineHeight`. Leave them
out to inherit from `settings` — a document that overrides everything cannot be restyled.

## Data fields

`[Bracketed]` tokens are substituted per recipient, and survive rendering untouched. They work
anywhere text does, including inside a `href`. `mail-designer fields draft.json` lists the ones
a document uses — that is the list the sending application has to supply.

Either substitute them yourself (`render --data values.json`) or leave them in and let Brevo,
SendGrid or Mailchimp do it. Both are normal; sending the wrong one produces either a mail full
of brackets or a template already filled in for one person.

## What breaks in real clients

The renderer handles the structural side — nested tables, ghost tables for Outlook, VML for
rounded buttons, `mso-line-height-rule`, stacking media queries. These are the parts it cannot
do for you:

- **Keep it under 102 kB.** Gmail clips the rest of the message and shows "View entire
  message". `check` reports the size; long inline styles and base64 images are what push it
  over.
- **Give every image an `alt`.** Blocked images are the default in Outlook, so the alt text is
  the mail for a large share of readers.
- **Nothing wider than `settings.width`.** A fixed-width image or table inside a 640px mail
  produces a horizontal scrollbar on a phone.
- **Set a preheader.** Without one the inbox shows the first words of the body, which is
  usually "View this email in your browser".
- **Send a plain-text alternative.** `render --text` produces one from the same document.

`check` reports every one of these, and `check --strict` fails on them.
