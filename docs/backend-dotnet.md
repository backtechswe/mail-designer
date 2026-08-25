# .NET-backend

## Behöver du ett NuGet-paket?

**Nej, inte för att redigeraren ska fungera.** Redigeraren är React och pratar med din
backend över HTTP. Implementerar din ASP.NET-controller de fem endpoints i
[templates.md](./templates.md) så använder du `createRestTemplateStore` och är klar.

```csharp
[ApiController]
[Route("api/mail-templates")]
public class MailTemplatesController : ControllerBase
{
    // document lagras som jsonb/nvarchar(max) — servern behöver aldrig tolka innehållet.
    [HttpGet] public Task<IEnumerable<TemplateSummary>> List() => ...;
    [HttpGet("{id}")] public Task<ActionResult<TemplateDto>> Get(string id) => ...;
    [HttpPost] public Task<ActionResult<TemplateDto>> Create(SaveTemplateDto body) => ...;
    [HttpPut("{id}")] public Task<ActionResult<TemplateDto>> Update(string id, SaveTemplateDto body) => ...;
    [HttpDelete("{id}")] public Task<IActionResult> Delete(string id) => ...;
}

public record TemplateDto(string Id, string Name, JsonDocument Document,
                          string? CreatedAt, string? UpdatedAt, JsonDocument? Meta);
```

Notera `JsonDocument`: **backend ska inte deserialisera dokumentet till typade klasser** för
att lagra det. Gör den det blir varje nytt blockfält en breaking change i två språk. Lagra
det ogenomskinligt.

## När ett NuGet-paket faktiskt vore värt det

Bara i ett fall: när **.NET-backenden själv ska rendera mailet** — köra ett schemalagt
utskick från en worker utan Node i bilden.

Då behövs en port av `src/render/`. Två saker gör det överkomligt:

1. **Renderaren är rena strängoperationer.** Ingen DOM, inga beroenden, ingen asynkronitet.
   Filerna i `src/render/html/` går att översätta nästan rad för rad.
2. **Specifikationen finns redan, i körbar form.**
   - `schema/mail-document.v1.json` — indataformatet, tillräckligt för att generera C#-typer.
   - `test/fixtures/*.json` + `test/golden/*.html` — **konformanssviten**. En C#-renderare är
     korrekt exakt när den förvandlar fixtures till golden-filerna, byte för byte.

Det gör porten till ett avgränsat arbete med ett objektivt slutkriterium, inte en
öppen tolkningsfråga. Skissen på ett sådant paket:

```
BackTech.MailDesigner/
├─ MailDocument.cs        records som speglar schemat (JsonDocument för okända fält)
├─ Render/
│  ├─ MailRenderer.cs     Render(MailDocument, RenderOptions) -> RenderResult
│  ├─ Skeleton.cs         doctype, meta, MSO-fixar, preheader
│  ├─ Css.cs              klientåterställningar + media-frågan
│  ├─ Columns.cs          bredduträkning + stapling
│  ├─ Blocks/*.cs         ett per blocktyp
│  ├─ MergeFields.cs
│  └─ Sanitizer.cs        eller HtmlSanitizer via NuGet
└─ tests/ConformanceTests.cs   läser ../../test/fixtures + ../../test/golden
```

`Sanitizer` är den enda delen där ett riktigt beroende är att föredra framför en port —
`HtmlSanitizer` i .NET bygger på en verklig HTML-parser och är strängt bättre än vår
regex-baserade variant, som är medvetet begränsad (se docblocket i `src/render/sanitize.ts`).
Det gör att C#-utdatan kan avvika från golden-filen för `html`-blocket; håll det blocket
utanför konformanssviten eller normalisera dess utdata i testet.

## Mellanvägen: kör renderaren i Node från .NET

Innan du portar 700 rader, väg av mot alternativet. `@backtech/mail-designer/render` är
ren ESM utan beroenden, så det räcker med ett script:

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

En kodväg, inga två implementationer att hålla i synk, och garanterat samma mail som
förhandsvisningen. Kräver att Node finns på maskinen — vilket det gör i en container du
själv bygger, men inte nödvändigtvis i en delad IIS-miljö. Det är hela avvägningen.
