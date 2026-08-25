# E-postkompatibilitet

Vad renderaren gör för att HTML:en ska hålla i både nya och gamla klienter, vad som degraderar
graciöst, och vad som inte går att garantera utan att skicka riktiga testmejl.

Varje punkt nedan finns som en kommentar i koden vid den rad som gör den, och de flesta vaktas
av ett test i `test/render.test.mjs`. Det är avsiktligt: en workaround utan förklaring blir
raderad av nästa person som läser koden.

## Grunden

| Vad | Varför |
|---|---|
| XHTML 1.0 Transitional-doctype | Det klienterna förväntar sig. Utan doctype hamnar äldre Outlook i quirks mode |
| Allt i tabeller, `role="presentation"` | Flexbox och grid finns inte i Word-motorn. `role` gör att skärmläsare inte läser upp layouten som en datatabell |
| **Allt visuellt inline** | `<style>` i `<head>` strippas av ett fåtal klienter och gateways. Inget utseende får bero enbart på den |
| `border-collapse` + `mso-table-lspace/rspace` | Utan dem visar flera klienter hårstreck mellan celler |
| `<o:PixelsPerInch>96</o:PixelsPerInch>` | Utan den skalar Outlook om alla px-mått |
| `x-apple-disable-message-reformatting` | Stoppar Apple Mail från att flöda om layouten själv |
| `format-detection: telephone=no` | Stoppar iOS från att göra telefonnummer och datum till blå länkar |
| `a[x-apple-data-detectors]` | Färgar om dem som iOS ändå hittar |
| `.ExternalClass` | Outlook.com sätter annars sitt eget radavstånd |

## Layout

**Innehållskolumnen är `width:100%` med `max-width`, inte en fast bredd.** En tabell med fast
bredd kan inte krympa, så ett 600 px-mejl skrollar i sidled på en telefon. Outlook ignorerar
`max-width` och skulle då sträcka innehållet över hela fönstret — därför får just Outlook en
**ghost-tabell** med den riktiga bredden bakom `<!--[if mso]>`.

**Kolumnmellanrum är cellpadding, inte `gap`** — `gap` finns inte i e-post. Procenten breddas
för att kompensera, så alla kolumner får exakt samma innehållsbredd och raden ligger ändå kant
i kant. Summan blir alltid exakt 100 %, även om de angivna bredderna överstiger det: Outlook
skjuter ut en för bred kolumn ur mejlet i stället för att radbryta.

**Stapling på mobil sker via en media-fråga.** Outlook för dator ignorerar media-frågor, vilket
är precis vad man vill — den är alltid en bred vy.

## Typografi

**Radavstånd anges i px, med `mso-line-height-rule: exactly`.** Word-motorn ignorerar ett
enhetslöst radavstånd och sätter sitt eget, vilket tyst ändrar rytmen i varje stycke.

**`word-break: break-word` på all text.** En inklistrad URL utan blanksteg vidgar annars
tabellen förbi mejlets egen bredd i Outlook och slår sönder all justering.

**Inget generellt typsnittsöverstyre för Outlook.** Ett `font-family: … !important` i ett
`[if mso]`-block är ett vanligt råd, men det slår ut varje medvetet typsnittsval i dokumentet.
Det är bara rätt när man använder ett webbtypsnitt — och den här redigeraren erbjuder bara
web-safe-stackar, som Outlook kan rendera. (Det här *fanns* här och är borttaget; ett test
vaktar att det inte kommer tillbaka.)

**`<p>`, `<ul>` och `<a>` får explicita marginaler och färger.** E-post har inga pålitliga
descendant-selektorer, och klienternas standardvärden skiljer sig kraftigt — Gmail färgar om
länkar till sin egen blå om man inte säger annat.

## Knappar

En tabellcell med bakgrund och radie, med en `<a>` som fyller den, plus `mso-padding-alt` som
ger Outlook den padding den vägrar ta från länken.

Rundade hörn är det enda Outlook inte kan göra med CSS — det kräver VML. VML kräver bestämda
pixelmått, så vi genererar det **bara när knappen har en angiven bredd**. Utan bredd blir
knappen rak i Outlook och rundad i övriga: en kosmetisk skillnad, inte en trasig layout, och
klart bättre än att gissa en storlek och skicka en klippt knapp.

## Bilder

`width`-attribut *och* `max-width` i CSS: attributet för Outlook som ignorerar `max-width`,
CSS:en för alla andra så bilden krymper på en telefon i stället för att tvinga fram sidoskroll.
`display: block` tar bort luftgapet under bilden. `border="0"` mot ramar i äldre klienter.

## Vad som degraderar, och till vad

| Funktion | Där den inte fungerar | Vad som händer i stället |
|---|---|---|
| Egen marginal på mobil | Outlook för dator (med flit), klienter som strippar `<style>` | Desktopmarginalen används |
| Staplade kolumner på mobil | Samma | Kolumnerna står kvar sida vid sida |
| Rundade hörn på knapp | Outlook, utan angiven bredd | Rak knapp |
| Rundade hörn på bild | Outlook | Rak bild |
| Bakgrundsbild på sektion | Outlook | Bakgrundsfärgen bakom den. **Renderaren varnar** |

Därför måste desktopvärdet alltid vara det som *fungerar*, inte bara det som är rymligast.
Mobilvärdet är en förbättring ovanpå.

## Kontroller som körs automatiskt

`inspectEmail(doc, result)` returnerar det en förhandsvisning inte kan visa:

| Kontroll | Nivå | Varför |
|---|---|---|
| `gmail-clipping` | fel | Gmail klipper mejl över ~102 KB och gömmer resten bakom en länk de flesta aldrig klickar — en avregistreringslänk kan försvinna helt |
| `data-uri-image` | fel | Gmail vägrar `data:`-URI:er i `<img>`. Mottagaren ser alt-texten |
| `background-image` | varning | Outlook behöver VML vi inte genererar |
| `missing-alt` | varning | Bilder är blockerade som standard i många klienter; alt-texten *är* innehållet då |
| `no-preheader` | varning | Inkorgen visar annars början av brödtexten |
| `wide-content` | varning | Över 640 px blir trångt i flera förhandsvisningsrutor |
| `no-plain-text` | varning | En saknad textdel räknas emot dig i skräppostfilter |

## Vad som inte går att garantera härifrån

Renderaren skriver HTML som följer allt ovanstående, och testerna vaktar att den fortsätter
göra det. Men **ingen mängd tester ersätter ett riktigt testmejl.** Klienter uppdateras, och
samma klient beter sig olika beroende på konto­typ — Gmail strippar t.ex. `<style>` för konton
som hämtas via POP/IMAP men inte för sina egna.

Innan en mall används i skarpt läge: skicka den till dig själv och titta i **Gmail (web och
iOS), Apple Mail, Outlook för Windows och Outlook.com**. Det är de fyra som täcker de olika
renderingsmotorerna. `test/golden/*.html` går att öppna direkt i en webbläsare, men en
webbläsare är inte en e-postklient.
