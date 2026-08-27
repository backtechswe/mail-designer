# Using it from a .NET backend

## Do you need a NuGet package?

**No — not for the editor to work.** The editor is React, and it talks to your backend over
HTTP. Implement the five endpoints in [templates.md](./templates.md) in an ASP.NET controller,
point `createRestTemplateStore` at it, and you are done.

```csharp
[ApiController]
[Route("api/mail-templates")]
public class MailTemplatesController : ControllerBase
{
    // document is stored as jsonb / nvarchar(max) — the server never parses its contents.
    [HttpGet] public Task<IEnumerable<TemplateSummary>> List() => ...;
    [HttpGet("{id}")] public Task<ActionResult<TemplateDto>> Get(string id) => ...;
    [HttpPost] public Task<ActionResult<TemplateDto>> Create(SaveTemplateDto body) => ...;
    [HttpPut("{id}")] public Task<ActionResult<TemplateDto>> Update(string id, SaveTemplateDto body) => ...;
    [HttpDelete("{id}")] public Task<IActionResult> Delete(string id) => ...;
}

public record TemplateDto(string Id, string Name, JsonDocument Document,
                          string? CreatedAt, string? UpdatedAt, JsonDocument? Meta);
```

Note the `JsonDocument`: **do not deserialise the document into typed classes just to store
it.** If you do, every new block field becomes a breaking change in two languages at once.
Store it opaquely.

## Rendering the email from .NET

The one case where you need more than an HTTP controller is when the **backend itself has to
render** — a scheduled send from a worker with no Node in the picture.

Before porting anything, weigh it against running the renderer as-is.
`@backtech/mail-designer/render` is plain ESM with no dependencies, so a script is enough:

```csharp
// echo '<json>' | node render.mjs   ->  { "html": "...", "text": "..." }
var psi = new ProcessStartInfo("node", "render.mjs") { RedirectStandardInput = true, ... };
```

```js
// render.mjs
import { toHtml } from "@backtech/mail-designer/render";
const doc = JSON.parse(await new Response(process.stdin).text());
process.stdout.write(JSON.stringify(toHtml(doc.document, doc.options)));
```

One code path, no second implementation to keep in sync, and the same email the preview
showed. It needs Node on the machine — true in a container you build yourself, not
necessarily true in a shared IIS environment. That is the whole trade-off.

## If you do port the renderer

Two things make it a bounded job rather than an open-ended one:

1. **The renderer is pure string operations.** No DOM, no dependencies, nothing async. The
   files under `src/render/html/` translate almost line for line.
2. **The specification already exists in executable form.**
   - `schema/mail-document.v1.json` — the input format, enough to generate C# types from.
   - `test/fixtures/*.json` + `test/golden/*.html` — the **conformance suite**. A C#
     renderer is correct exactly when it turns the fixtures into the golden files, byte for
     byte. That is an objective finish line, not a matter of interpretation.

One caveat. Sanitising is the single part where a real dependency beats a port: .NET's
`HtmlSanitizer` is built on an actual HTML parser and is strictly better than the scanner in
`src/render/sanitize.ts`, which is deliberately limited (the reasoning is in that file's
docblock). Using it means your output for the `html` block may differ from the golden file —
so keep that block out of the conformance suite, or normalise its output in the test.
