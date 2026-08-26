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
      masthead("Sendly", "Getting started", { ink, muted }),

      section([image(photo("homeOffice", { w: 1200, h: 620 }), "A bright home office")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        eyebrow("Welcome", accent),
        heading("Glad you are here, [Name]", {
          level: 1,
          fontSize: 30,
          lineHeight: 1.22,
          padding: [0, 0, 14, 0],
        }),
        text(
          "<p>Your account is ready. Three short steps and your first mailing is out — " +
            "about ten minutes in all, and you need not do them in one sitting.</p>",
          { color: muted, lineHeight: 1.7, padding: [0, 0, 26, 0] },
        ),

        step(1, "Add your recipients", "Upload a spreadsheet or paste a list. We clear out duplicates and broken numbers for you."),
        step(2, "Write the message", "Use [Name] and your other columns to make every mail personal without writing it twice."),
        step(3, "Preview and send", "See exactly what each recipient gets before anything leaves the building."),

        button("Send your first mailing", {
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
              heading("Stuck?", { level: 3, fontSize: 15, padding: [0, 0, 6, 0] }),
              text('<p>Reply to this email. It reaches a person.</p>', {
                fontSize: 14,
                color: muted,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              heading("Want to see how others do it?", {
                level: 3,
                fontSize: 15,
                padding: [0, 0, 6, 0],
              }),
              text('<p><a href="https://">Read three short examples →</a></p>', {
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
        "You are getting this because you created an account with us.",
        '<a href="[Unsubscribe]">Unsubscribe</a> · Example Company Ltd · Exampleton',
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
      preheader: "Three steps to your first mailing. About ten minutes.",
    },
  );
}
