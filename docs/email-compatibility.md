# Email compatibility

What the renderer does to make its HTML survive both current and ancient clients, what
degrades gracefully, and what cannot be guaranteed from here without sending real test mail.

Every point below exists as a comment in the code at the line that implements it, and most are
guarded by a test in `test/render.test.mjs`. That is deliberate: a workaround with no
explanation gets deleted by the next person to read the code.

## The basics

| What | Why |
|---|---|
| XHTML 1.0 Transitional doctype | What clients expect. With no doctype, older Outlook falls into quirks mode |
| Tables throughout, `role="presentation"` | Flexbox and grid do not exist in the Word engine. The `role` stops screen readers announcing the layout as a data table |
| **Everything visual inline** | `<style>` in `<head>` is stripped by a handful of clients and gateways. No appearance may depend on it alone |
| `border-collapse` + `mso-table-lspace/rspace` | Without them several clients show hairlines between cells |
| `<o:PixelsPerInch>96</o:PixelsPerInch>` | Without it Outlook rescales every px measurement |
| `x-apple-disable-message-reformatting` | Stops Apple Mail reflowing the layout on its own |
| `format-detection: telephone=no` | Stops iOS turning phone numbers and dates into blue links |
| `a[x-apple-data-detectors]` | Recolours the ones iOS finds anyway |
| `.ExternalClass` | Otherwise Outlook.com applies its own line height |

## Layout

**The content column is `width:100%` with a `max-width`, not a fixed width.** A fixed-width
table cannot shrink, so a 600px email scrolls sideways on a phone. Outlook ignores `max-width`
and would then stretch the content across the whole window — so Outlook alone gets a **ghost
table** carrying the real width, behind `<!--[if mso]>`.

**Column gaps are cell padding, not `gap`** — `gap` does not exist in email. The percentages
are widened to compensate, so every column gets exactly the same content width and the row
still sits edge to edge. The total is always exactly 100%, even when the given widths exceed
it: Outlook pushes an over-wide column out of the email rather than wrapping it.

**Stacking on mobile happens through a media query.** Outlook on the desktop ignores media
queries, which is exactly what you want — it is always a wide view.

## Typography

**Line height is set in px, with `mso-line-height-rule: exactly`.** The Word engine ignores a
unitless line height and applies its own, quietly changing the rhythm of every paragraph.

**`word-break: break-word` on all text.** Otherwise a pasted URL with no spaces widens the
table past the email's own width in Outlook and breaks every alignment in it.

**No blanket font override for Outlook.** A `font-family: … !important` inside an `[if mso]`
block is common advice, but it overrides every deliberate font choice in the document. It is
only right when you use a web font — and this editor offers only web-safe stacks, which
Outlook can render. (This *was* here and has been removed; a test guards against its return.)

**`<p>`, `<ul>` and `<a>` get explicit margins and colours.** Email has no reliable descendant
selectors, and client defaults differ wildly — Gmail recolours links to its own blue unless
told otherwise.

## Buttons

A table cell with a background and a radius, an `<a>` filling it, plus `mso-padding-alt` to
give Outlook the padding it refuses to take from the link.

Rounded corners are the one thing Outlook cannot do in CSS — it needs VML. VML needs definite
pixel measurements, so it is generated **only when the button has an explicit width**. Without
one the button is square in Outlook and rounded elsewhere: a cosmetic difference rather than a
broken layout, and much better than guessing a size and sending a clipped button.

## Images

A `width` attribute *and* `max-width` in CSS: the attribute for Outlook, which ignores
`max-width`; the CSS for everyone else, so the image shrinks on a phone instead of forcing
sideways scroll. `display: block` removes the gap underneath. `border="0"` against frames in
older clients.

## What degrades, and to what

| Feature | Where it does not work | What happens instead |
|---|---|---|
| Separate mobile padding | Outlook desktop (deliberately), clients that strip `<style>` | The desktop padding is used |
| Columns stacking on mobile | Same | The columns stay side by side |
| Rounded button corners | Outlook, with no explicit width | A square button |
| Rounded image corners | Outlook | A square image |
| Section background image | Outlook | The background colour behind it. **The renderer warns** |

Which is why the desktop value must always be the one that *works*, not merely the roomiest.
The mobile value is an improvement layered on top.

## Checks that run automatically

`inspectEmail(doc, result)` returns what a preview cannot show you:

| Check | Level | Why |
|---|---|---|
| `gmail-clipping` | error | Gmail clips mail over ~102 KB and hides the rest behind a link most people never click — an unsubscribe link can disappear entirely |
| `data-uri-image` | error | Gmail refuses `data:` URIs in `<img>`. The recipient sees the alt text |
| `background-image` | warning | Outlook needs VML we do not generate |
| `missing-alt` | warning | Images are blocked by default in many clients; there the alt text *is* the content |
| `no-preheader` | warning | Otherwise the inbox shows the start of the body text |
| `wide-content` | warning | Past 640px it gets cramped in several preview panes |
| `no-plain-text` | warning | A missing text part counts against you in spam filters |

## What cannot be guaranteed from here

The renderer writes HTML that follows all of the above, and the tests guard that it keeps
doing so. But **no amount of testing replaces a real test email.** Clients update, and the
same client behaves differently depending on account type — Gmail strips `<style>` for
accounts fetched over POP/IMAP but not for its own, for instance.

Before a template goes anywhere real: send it to yourself and look at it in **Gmail (web and
iOS), Apple Mail, Outlook for Windows and Outlook.com**. Those four cover the distinct
rendering engines. `test/golden/*.html` opens directly in a browser, but a browser is not an
email client.

## Dark mode

Three mechanisms, because clients do three different things. Enabled through `settings.dark`
with four colours: page background, content background, text, links.

| Client | What it does | What we do |
|---|---|---|
| Apple Mail, iOS Mail, Outlook for Mac | Honours `prefers-color-scheme`, but **only** if the email also declares `color-scheme` — otherwise Apple Mail decides the email is light-only and inverts it itself | Two meta tags in the head, `:root{color-scheme:light dark}`, and a media query with `!important` |
| Outlook.com | Ignores media queries. Rewrites the DOM instead: it copies `bgcolor` to `data-ogsb` and colour styles to `data-ogsc`, then restyles from those | Selectors on `[data-ogsb]` and `[data-ogsc]` |
| Gmail | Has no dark mode for HTML mail on desktop, and on Android inverts nothing the author set explicitly | Setting the colours *is* the handling |

Both the `!important` and the descendant selector (`.md-dark-text, .md-dark-text *`) are
necessary: headings and text blocks set their colour **inline**, and inline beats a class
unless the class is more specific and marked important.

**No client inverts images.** A PNG logo on a white background becomes a glowing white
rectangle in a dark email. It is the most common dark-mode bug in email and it cannot be
solved in CSS — use a logo with transparency. The inspector says so, and `inspectEmail` raises
`no-dark-mode` for an email that set no dark colours at all.

**Nothing is emitted for a document without `settings.dark`.** No meta tags, no classes, no
rules — every byte counts against Gmail's clipping limit, and a class with no rule behind it
is markup in every email that does nothing.
