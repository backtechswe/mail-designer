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
 * Editorial newsletter.
 *
 * Direction: a printed monthly, not a marketing blast. Georgia throughout — the one
 * genuinely characterful face that is safe in every mail client — set large and loose, with
 * a cool blue-grey page so the white column reads as paper. The full-bleed hero and the
 * dark closing band are the only two moments of contrast; everything between them is rules
 * and space.
 */
export function newsletter(): MailDocument {
  resetIds("nl");

  const ink = "#14181f";
  const muted = "#5f6b7a";
  const accent = "#1a4fd6";
  const rule = "#dfe4ea";
  const serif = "Georgia, 'Times New Roman', serif";

  return doc(
    [
      masthead("The Newsletter", "March 2026 · No. 14", { ink, muted }),

      // No padding: the hero runs to the edges of the content column.
      section([image(photo("officeTeam", { w: 1280, h: 720 }), "The team at the office")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        eyebrow("Report of the month", accent),
        heading("What 4,000 sends taught us", {
          level: 1,
          fontSize: 34,
          lineHeight: 1.18,
          fontFamily: serif,
          padding: [0, 0, 16, 0],
        }),
        text(
          "<p>We went through every mailing we have sent since the autumn, looking for patterns. " +
            "Three of them held almost everywhere — and one went straight against what we expected.</p>",
          { fontSize: 18, lineHeight: 1.65, color: muted, fontFamily: serif, padding: [0, 0, 20, 0] },
        ),
        button("Read the full report", {
          backgroundColor: ink,
          borderRadius: 4,
          width: 220,
          fontSize: 15,
        }),
      ]),

      section(
        [
          divider({ color: rule, padding: [0, 0, 28, 0] }),
          columns([
            column([
              image(photo("desk", { w: 560, h: 380 }), "A desk from above", {
                padding: [0, 0, 14, 0],
              }),
              eyebrow("Timing", accent, { fontSize: 11 }),
              heading("Tuesday morning is a myth", {
                level: 3,
                fontSize: 20,
                lineHeight: 1.3,
                fontFamily: serif,
                padding: [0, 0, 8, 0],
              }),
              text(
                "<p>The gap between the best and worst day to send was under three per cent. " +
                  '<a href="https://">Read why →</a></p>',
                { fontSize: 15, lineHeight: 1.6, color: muted, padding: [0, 0, 0, 0] },
              ),
            ]),
            column([
              image(photo("laptopTable", { w: 560, h: 380 }), "Hands at a laptop", {
                padding: [0, 0, 14, 0],
              }),
              eyebrow("Subject lines", accent, { fontSize: 11 }),
              heading("Shorter does not always win", {
                level: 3,
                fontSize: 20,
                lineHeight: 1.3,
                fontFamily: serif,
                padding: [0, 0, 8, 0],
              }),
              text(
                "<p>Concrete beats short. Six words that say something beat four that do not. " +
                  '<a href="https://">See the examples →</a></p>',
                { fontSize: 15, lineHeight: 1.6, color: muted, padding: [0, 0, 0, 0] },
              ),
            ]),
          ]),
        ],
        { padding: [0, 40, 32, 40] },
      ),

      // Full width: the colour bleeds edge to edge and closes the letter.
      section(
        [
          heading("Hear it live", {
            level: 2,
            align: "center",
            color: "#ffffff",
            fontSize: 26,
            fontFamily: serif,
            padding: [0, 0, 10, 0],
          }),
          text("<p>We walk through the whole report on 24 April at 3pm.</p>", {
            align: "center",
            color: "#aab4c2",
            fontSize: 15,
            padding: [0, 0, 20, 0],
          }),
          button("Save a seat", {
            align: "center",
            backgroundColor: "#ffffff",
            textColor: ink,
            borderRadius: 4,
            width: 180,
            fontSize: 15,
            padding: [0, 0, 0, 0],
          }),
        ],
        { fullWidth: true, backgroundColor: ink, padding: [44, 40, 48, 40] },
      ),

      footer({ muted, rule }, [
        "You are getting this because you subscribe to The Newsletter.",
        '<a href="[Unsubscribe]">Avsluta prenumerationen</a> · <a href="https://">Uppdatera dina uppgifter</a>',
        "Exempelbolaget AB · Exempelgatan 4 · 123 45 Exempelstad",
      ]),
    ],
    {
      width: 640,
      backgroundColor: "#eceff3",
      contentBackgroundColor: "#ffffff",
      fontFamily: serif,
      fontSize: 16,
      lineHeight: 1.65,
      textColor: ink,
      linkColor: accent,
      preheader: "Three things 4,000 sends taught us — and an invitation for 24 April.",
    },
  );
}
