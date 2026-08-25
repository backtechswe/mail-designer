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
          eyebrow("Du är inbjuden", "#a89bc7", { align: "center", padding: [0, 0, 14, 0] }),
          heading("Vårfesten 2026", {
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
          text("<p>Fredag 12 juni · 18.00 · Storgatan 4, Kalmar</p>", {
            align: "center",
            color: "#d5cce8",
            fontSize: 17,
            padding: [0, 0, 0, 0],
          }),
        ],
        { fullWidth: true, backgroundColor: night, padding: [60, 40, 60, 40] },
      ),

      section([image(photo("staircase", { w: 1200, h: 640 }), "Trappan i festvåningen")], {
        padding: [0, 0, 0, 0],
      }),

      section([
        text(
          "<p>Hej [Namn],</p>" +
            "<p>Det har gått ett år sedan sist, och vi tycker att det är dags igen. " +
            "Mat, musik och ett kort tal som vi lovar att hålla kort.</p>" +
            "<p>Säg till senast <b>5 juni</b> så vi vet hur många vi blir.</p>",
          { lineHeight: 1.7, padding: [0, 0, 22, 0] },
        ),
        button("Anmäl mig", {
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
              eyebrow("När", muted, { fontSize: 11 }),
              text("<p>Fredag 12 juni<br />18.00 – sent</p>", {
                fontSize: 15,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              eyebrow("Var", muted, { fontSize: 11 }),
              text("<p>Festvåningen<br />Storgatan 4, Kalmar</p>", {
                fontSize: 15,
                lineHeight: 1.6,
                padding: [0, 0, 0, 0],
              }),
            ]),
            column([
              eyebrow("Klädsel", muted, { fontSize: 11 }),
              text("<p>Ledigt men<br />gärna lite festligt</p>", {
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
        "Frågor? Svara på det här mejlet så hör vi av oss.",
        '<a href="[Avregistrera]">Vill du inte ha fler inbjudningar?</a>',
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
      preheader: "Fredag 12 juni, 18.00 — Storgatan 4 i Kalmar. Anmäl dig senast 5 juni.",
    },
  );
}
