import type { MailDocument } from "../types.js";
import { photo } from "./images.js";
import {
  button,
  column,
  columns,
  divider,
  doc,
  eyebrow,
  footer,
  heading,
  image,
  masthead,
  resetIds,
  section,
  text,
} from "./builders.js";

/**
 * Welcome / onboarding mail.
 *
 * Direction: calm and green, closer to a letter than a product tour. The three steps are
 * numbered because they genuinely are a sequence — do this, then this, then this — which is
 * the only thing that earns a numbered marker. Each number sits in its own narrow column so
 * the text beside it keeps a straight left edge all the way down.
 */
export function welcome(): MailDocument {
  resetIds("we");

  const ink = "#1c2321";
  const muted = "#5d6b66";
  const accent = "#2f7d5f";
  const rule = "#dde5e1";

  const step = (n: number, title: string, body: string) =>
    columns(
      [
        column(
          [
            text(`<p><b>${n}</b></p>`, {
              fontSize: 26,
              lineHeight: 1.1,
              color: accent,
              align: "center",
              padding: [0, 0, 0, 0],
            }),
          ],
          14,
        ),
        column([
          heading(title, {
            level: 3,
            fontSize: 17,
            lineHeight: 1.35,
            padding: [2, 0, 6, 0],
          }),
          text(`<p>${body}</p>`, {
            fontSize: 15,
            lineHeight: 1.65,
            color: muted,
            padding: [0, 0, 0, 0],
          }),
        ]),
      ],
      { gap: 16, padding: [0, 0, 22, 0] },
    );

  return doc(
    [
      masthead("Utskick", "Kom igång", { ink, muted }),

      section([image(photo("homeOffice", { w: 1200, h: 620 }), "Ljust hemmakontor")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        eyebrow("Välkommen", accent),
        heading("Kul att du är här, [Namn]", {
          level: 1,
          fontSize: 30,
          lineHeight: 1.22,
          padding: [0, 0, 14, 0],
        }),
        text(
          "<p>Ditt konto är klart. Tre korta steg så har du skickat ditt första utskick — " +
            "det tar ungefär tio minuter, och du behöver inte göra dem i ett svep.</p>",
          { color: muted, lineHeight: 1.7, padding: [0, 0, 26, 0] },
        ),

        step(1, "Lägg in dina mottagare", "Ladda upp en Excel-fil eller klistra in en lista. Vi städar dubbletter och trasiga nummer åt dig."),
        step(2, "Skriv meddelandet", "Använd [Namn] och andra kolumner för att göra varje utskick personligt utan att skriva det flera gånger."),
        step(3, "Förhandsgranska och skicka", "Se exakt vad varje mottagare får innan något lämnar systemet."),

        button("Gör ditt första utskick", {
          backgroundColor: accent,
          borderRadius: 6,
          width: 250,
          padding: [4, 0, 0, 0],
        }),
      ]),

      section(
        [
          divider({ color: rule, padding: [0, 0, 20, 0] }),
          columns([
            column([
              heading("Fastnat?", { level: 3, fontSize: 15, padding: [0, 0, 6, 0] }),
              text('<p>Svara på det här mejlet. Det går till en människa.</p>', {
                fontSize: 14,
                color: muted,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              heading("Vill du se hur andra gör?", {
                level: 3,
                fontSize: 15,
                padding: [0, 0, 6, 0],
              }),
              text('<p><a href="https://">Läs tre korta exempel →</a></p>', {
                fontSize: 14,
                color: muted,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
          ]),
        ],
        { padding: [0, 40, 24, 40] },
      ),

      footer({ muted, rule }, [
        "Du får det här mejlet för att du skapade ett konto hos oss.",
        '<a href="[Avregistrera]">Avregistrera</a> · BäckTech AB · Kalmar',
      ]),
    ],
    {
      width: 600,
      backgroundColor: "#f1f5f3",
      contentBackgroundColor: "#ffffff",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: 16,
      lineHeight: 1.65,
      textColor: ink,
      linkColor: accent,
      preheader: "Tre steg till ditt första utskick. Tar ungefär tio minuter.",
    },
  );
}
