import type { MailDocument } from "../types.js";
import {
  button,
  column,
  columns,
  divider,
  doc,
  eyebrow,
  footer,
  heading,
  resetIds,
  section,
  text,
} from "./builders.js";

/**
 * Booking or order confirmation.
 *
 * Direction: no photography at all. A confirmation is read in five seconds by someone
 * checking one fact, so the design's whole job is to make the details findable — a narrow
 * measure, a tinted panel holding nothing but label/value pairs, and a single blue action.
 * Anything decorative here would be in the way.
 */
export function receipt(): MailDocument {
  resetIds("re");

  const ink = "#1a1d21";
  const muted = "#6a7480";
  const accent = "#2f54eb";
  const rule = "#e3e6ea";
  const panel = "#f4f6f9";

  const detail = (label: string, value: string) =>
    column([
      eyebrow(label, muted, { fontSize: 10, padding: [0, 0, 5, 0] }),
      text(`<p><b>${value}</b></p>`, {
        fontSize: 15,
        lineHeight: 1.5,
        padding: [0, 0, 0, 0],
      }),
    ]);

  return doc(
    [
      section(
        [
          text(
            '<span style="letter-spacing:0.16em;font-weight:bold">KLIPPOTEKET</span>',
            { fontSize: 12, color: muted, padding: [0, 0, 0, 0] },
          ),
        ],
        { padding: [30, 36, 24, 36] },
      ),

      section(
        [
          heading("Tack, [Namn]!", {
            level: 1,
            fontSize: 28,
            lineHeight: 1.25,
            padding: [0, 0, 10, 0],
          }),
          text("<p>Din tid är bokad. Vi har lagt in den här nedan — spara gärna mejlet.</p>", {
            color: muted,
            lineHeight: 1.65,
            padding: [0, 0, 0, 0],
          }),
        ],
        { padding: [0, 36, 24, 36] },
      ),

      // A tinted panel rather than a bordered card: borders inside an email column are one
      // more thing for a client to render differently.
      section(
        [
          columns([detail("Datum", "Tisdag 14 april"), detail("Tid", "10.30 – 11.15")], {
            gap: 20,
            padding: [0, 0, 20, 0],
          }),
          columns([detail("Hos", "Anna Lind"), detail("Plats", "Exempelgatan 12, Exempelstad")], {
            gap: 20,
            padding: [0, 0, 0, 0],
          }),
        ],
        { backgroundColor: panel, padding: [26, 28, 26, 28] },
      ),

      section(
        [
          button("Ändra eller avboka", {
            backgroundColor: accent,
            borderRadius: 6,
            width: 220,
            fontSize: 15,
            padding: [0, 0, 16, 0],
          }),
          text(
            "<p>Behöver du avboka? Gör det senast 24 timmar innan, annars debiteras halva priset.</p>",
            { fontSize: 13, lineHeight: 1.6, color: muted, padding: [0, 0, 0, 0] },
          ),
          divider({ color: rule, padding: [22, 0, 0, 0] }),
        ],
        { padding: [26, 36, 0, 36] },
      ),

      footer(
        { muted, rule: panel },
        [
          "Salong Exempel · Exempelgatan 12 · 123 45 Exempelstad · 010-123 45 67",
          "Det här är en bekräftelse och går inte att svara på.",
        ],
        "left",
      ),
    ],
    {
      width: 560,
      backgroundColor: "#eef0f3",
      contentBackgroundColor: "#ffffff",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: 16,
      lineHeight: 1.6,
      textColor: ink,
      linkColor: accent,
      preheader: "Tisdag 14 april, 10.30 hos Anna Lind. Exempelgatan 12, Exempelstad.",
    },
  );
}
