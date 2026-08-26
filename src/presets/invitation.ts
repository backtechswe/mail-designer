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
  resetIds,
  section,
  spacer,
  text,
} from "./builders.js";

/**
 * Event invitation.
 *
 * Direction: the card, not the flyer. It opens on a dark full-bleed band carrying nothing
 * but the occasion and the date — no logo, no navigation, no image competing with the type.
 * The photograph arrives second, once the reader already knows what they are being invited
 * to, and everything practical is pushed below the fold where it belongs.
 */
export function invitation(): MailDocument {
  resetIds("in");

  const night = "#16121f";
  const ink = "#221b2e";
  const muted = "#6b6178";
  const accent = "#6d4bd3";
  const rule = "#e4dff0";

  return doc(
    [
      section(
        [
          eyebrow("You are invited", "#a89bc7", { align: "center", padding: [0, 0, 14, 0] }),
          heading("Spring Party 2026", {
            level: 1,
            align: "center",
            color: "#ffffff",
            fontSize: 42,
            lineHeight: 1.08,
            padding: [0, 0, 18, 0],
          }),
          // A short rule instead of a subtitle: it separates without adding another voice.
          divider({
            color: accent,
            thickness: 2,
            width: 14,
            align: "center",
            padding: [0, 0, 18, 0],
          }),
          text("<p>Friday 12 June · 6pm · 4 Example Street, Exampleton</p>", {
            align: "center",
            color: "#d5cce8",
            fontSize: 17,
            padding: [0, 0, 0, 0],
          }),
        ],
        { fullWidth: true, backgroundColor: night, padding: [60, 40, 60, 40] },
      ),

      section([image(photo("staircase", { w: 1200, h: 640 }), "The staircase at the venue")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        text(
          "<p>Hi [Name],</p>" +
            "<p>It has been a year since the last one, and we think it is time again. " +
            "Food, music, and a short speech we promise to keep short.</p>" +
            "<p>Let us know by <b>5 June</b> so we know how many we will be.</p>",
          { lineHeight: 1.7, padding: [0, 0, 22, 0] },
        ),
        button("Count me in", {
          align: "center",
          backgroundColor: accent,
          borderRadius: 26,
          width: 220,
          padding: [0, 0, 0, 0],
        }),
      ]),

      section(
        [
          divider({ color: rule, padding: [0, 0, 24, 0] }),
          columns([
            column([
              eyebrow("When", muted, { fontSize: 11 }),
              text("<p>Friday 12 June<br />6pm until late</p>", {
                fontSize: 15,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              eyebrow("Where", muted, { fontSize: 11 }),
              text("<p>The venue<br />4 Example Street, Exampleton</p>", {
                fontSize: 15,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              eyebrow("Dress", muted, { fontSize: 11 }),
              text("<p>Relaxed, but<br />a little festive</p>", {
                fontSize: 15,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
          ]),
          spacer(8),
        ],
        { padding: [0, 40, 24, 40] },
      ),

      footer({ muted, rule }, [
        "Questions? Reply to this email and we will get back to you.",
        '<a href="[Unsubscribe]">Would you rather not get invitations?</a>',
      ]),
    ],
    {
      width: 600,
      backgroundColor: "#f3f0f7",
      contentBackgroundColor: "#ffffff",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: 16,
      lineHeight: 1.65,
      textColor: ink,
      linkColor: accent,
      preheader: "Friday 12 June, 6pm — 4 Example Street, Exampleton. Reply by 5 June.",
    },
  );
}
