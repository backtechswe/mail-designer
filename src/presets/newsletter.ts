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
      masthead("Nyhetsbrevet", "Mars 2026 · Nr 14", { ink, muted }),

      // No padding: the hero runs to the edges of the content column.
      section([image(photo("officeTeam", { w: 1280, h: 720 }), "Teamet på kontoret")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        eyebrow("Månadens rapport", accent),
        heading("Vad vi lärde oss av 4 000 utskick", {
          level: 1,
          fontSize: 34,
          lineHeight: 1.18,
          fontFamily: serif,
          padding: [0, 0, 16, 0],
        }),
        text(
          "<p>Vi gick igenom varje utskick vi gjort sedan i höstas och letade efter mönster. " +
            "Tre av dem visade sig gälla nästan överallt — och ett av dem gick tvärt emot vad vi trodde.</p>",
          { fontSize: 18, lineHeight: 1.65, color: muted, fontFamily: serif, padding: [0, 0, 20, 0] },
        ),
        button("Läs hela rapporten", {
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
              image(photo("desk", { w: 560, h: 380 }), "Skrivbord ovanifrån", {
                padding: [0, 0, 14, 0],
              }),
              eyebrow("Timing", accent, { fontSize: 11 }),
              heading("Tisdag morgon är en myt", {
                level: 3,
                fontSize: 20,
                lineHeight: 1.3,
                fontFamily: serif,
                padding: [0, 0, 8, 0],
              }),
              text(
                "<p>Skillnaden mellan bästa och sämsta utskicksdag var mindre än tre procent. " +
                  '<a href="https://">Läs varför →</a></p>',
                { fontSize: 15, lineHeight: 1.6, color: muted, padding: [0, 0, 0, 0] },
              ),
            ]),
            column([
              image(photo("laptopTable", { w: 560, h: 380 }), "Händer vid en laptop", {
                padding: [0, 0, 14, 0],
              }),
              eyebrow("Ämnesrader", accent, { fontSize: 11 }),
              heading("Kortare vinner inte alltid", {
                level: 3,
                fontSize: 20,
                lineHeight: 1.3,
                fontFamily: serif,
                padding: [0, 0, 8, 0],
              }),
              text(
                "<p>Konkret slår kort. Sex ord som säger något slår fyra som inte gör det. " +
                  '<a href="https://">Se exemplen →</a></p>',
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
          heading("Kom och lyssna live", {
            level: 2,
            align: "center",
            color: "#ffffff",
            fontSize: 26,
            fontFamily: serif,
            padding: [0, 0, 10, 0],
          }),
          text("<p>Vi går igenom hela rapporten den 24 april, klockan 15.00.</p>", {
            align: "center",
            color: "#aab4c2",
            fontSize: 15,
            padding: [0, 0, 20, 0],
          }),
          button("Anmäl dig", {
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
        "Du får det här brevet för att du prenumererar på Nyhetsbrevet.",
        '<a href="[Avregistrera]">Avsluta prenumerationen</a> · <a href="https://">Uppdatera dina uppgifter</a>',
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
      preheader: "Tre saker vi lärt oss av 4 000 utskick — och en inbjudan till den 24 april.",
    },
  );
}
