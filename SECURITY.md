# Security

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository ("Security" → "Report a
vulnerability"). Please do not open a public issue for anything exploitable.

Expect an acknowledgement within a few days. This is a small project; there is no SLA, and
there is no bounty.

## What this package does and does not defend against

Worth stating plainly, because one of the exported functions is called `sanitize`.

**The renderer's threat model is a document you did not write.** A `MailDocument` is JSON that
may have come from a database, an API, an agent, or another tenant, and recipient data comes
from a CRM, a form or an uploaded spreadsheet. Everything from those sources is treated as
untrusted: enum and numeric fields are coerced to known values, attribute values are escaped,
CSS values cannot break out of their declaration, URLs are checked for executable schemes after
entity decoding and control-character stripping, and the check runs again after recipient data
is substituted. `test/hostile.test.mjs` holds the payloads.

**`sanitizeEmailHtml` is not a general-purpose HTML sanitiser.** It is a whitelist over a
hand-written tokeniser, sized for the subset of HTML an email client renders. It is defence in
depth for this package's own rendering path — it stops a stored document executing script in
the editor's canvas and stops an event handler reaching a sent email. If you are storing HTML
written by one user and showing it to another, sanitise again server-side with a real parser.

**The `html` block is an escape hatch by design.** It exists so an author can paste markup the
block types do not cover. Its content is sanitised and its tags are balanced, so it cannot
break out of the renderer's own tables, but it is still the widest surface in the package. An
application that does not want it can remove it: `permissions={{ blocks: [...] }}` without
`"html"`.

**Out of scope:** what an email client does with valid HTML, the security of the host
application's storage or upload endpoint, and the contents of `onUploadImage`.
