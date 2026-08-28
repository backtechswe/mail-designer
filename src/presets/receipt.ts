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
          heading("Thank you, [Name]!", {
            level: 1,
            fontSize: 28,
            lineHeight: 1.25,
            padding: [0, 0, 10, 0],
          }),
          text("<p>Your appointment is booked. The details are below — worth keeping this email.</p>", {
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
          columns([detail("Date", "Tuesday 14 April"), detail("Time", "10:30 – 11:15")], {
            gap: 20,
            padding: [0, 0, 20, 0],
          }),
          columns([detail("With", "Robin Alvarez"), detail("Where", "12 Example Street, Exampleton")], {
            gap: 20,
            padding: [0, 0, 0, 0],
          }),
        ],
        { backgroundColor: panel, padding: [26, 28, 26, 28] },
      ),

      section(
        [
          button("Change or cancel", {
            backgroundColor: accent,
            borderRadius: 6,
            width: 220,
            fontSize: 15,
            padding: [0, 0, 16, 0],
          }),
          text(
            "<p>Need to cancel? Do it at least 24 hours ahead, or half the price is charged.</p>",
            { fontSize: 13, lineHeight: 1.6, color: muted, padding: [0, 0, 0, 0] },
          ),
          divider({ color: rule, padding: [22, 0, 0, 0] }),
        ],
        { padding: [26, 36, 0, 36] },
      ),

      footer(
        { muted, rule: panel },
        [
          "Salon Example · 12 Example Street · Exampleton · 020 7946 0123",
          "This is a confirmation and cannot be replied to.",
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
      preheader: "Tuesday 14 April, 10:30 with Robin Alvarez. 12 Example Street, Exampleton.",
    },
  );
}
