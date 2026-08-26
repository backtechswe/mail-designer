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
 * Product or campaign announcement.
 *
 * Direction: one thing, said once. A cool blue-grey page with a single burnt-orange accent —
 * complementary rather than analogous, so the call to action is the only warm thing on the
 * screen and the eye finds it without being shouted at. The product grid below is
 * deliberately quieter than the hero: it is the second look, not a competing one.
 */
export function campaign(): MailDocument {
  resetIds("ca");

  const ink = "#12242e";
  const muted = "#5b7180";
  const accent = "#d4592f";
  const rule = "#dce4e9";

  const product = (
    name: string,
    price: string,
    src: string,
    alt: string,
  ) =>
    column([
      image(src, alt, { borderRadius: 6, padding: [0, 0, 12, 0] }),
      heading(name, {
        level: 3,
        fontSize: 16,
        align: "center",
        lineHeight: 1.35,
        padding: [0, 0, 4, 0],
      }),
      text(`<p>${price}</p>`, {
        fontSize: 14,
        align: "center",
        color: muted,
        padding: [0, 0, 0, 0],
      }),
    ]);

  return doc(
    [
      masthead("Kafé Exempel", "Nyhetsbrev", { ink, muted }, { padding: [26, 32, 22, 32] }),

      section([image(photo("icedCoffee", { w: 1200, h: 840 }), "Iskaffe i högt glas")], {
        padding: [0, 0, 0, 0],
      }),

      section(
        [
          eyebrow("Nyhet", accent, { align: "center" }),
          heading("Sommarens iskaffe är här", {
            level: 1,
            align: "center",
            fontSize: 32,
            lineHeight: 1.2,
            padding: [0, 0, 14, 0],
          }),
          text(
            "<p>Långsamt bryggd över natten, serverad över is med en skvätt havregrädde. " +
              "Finns i baren från och med på fredag — och i butiken som flaska att ta med hem.</p>",
            { align: "center", color: muted, lineHeight: 1.7, padding: [0, 0, 22, 0] },
          ),
          button("Se hela menyn", {
            align: "center",
            backgroundColor: accent,
            borderRadius: 4,
            width: 200,
            padding: [0, 0, 0, 0],
          }),
        ],
        { padding: [36, 40, 36, 40] },
      ),

      section(
        [
          divider({ color: rule, padding: [0, 0, 26, 0] }),
          eyebrow("Passar bra till", muted, { align: "center", fontSize: 11 }),
          columns(
            [
              product("Havrebulle", "32 kr", photo("coffeeCake", { w: 480, h: 480 }), "Kaffebröd på fat"),
              product("Äppelpaj", "45 kr", photo("pie", { w: 480, h: 480 }), "Bit av äppelpaj"),
              product("Frukostskål", "68 kr", photo("breakfastBowl", { w: 480, h: 480 }), "Frukostskål ovanifrån"),
            ],
            { gap: 16 },
          ),
        ],
        { padding: [0, 32, 32, 32] },
      ),

      section(
        [
          text("<p><b>Fri leverans över 300 kr</b> · Hämta i butik samma dag</p>", {
            align: "center",
            color: "#ffffff",
            fontSize: 15,
            padding: [0, 0, 0, 0],
          }),
        ],
        { fullWidth: true, backgroundColor: ink, padding: [20, 32, 20, 32] },
      ),

      footer({ muted, rule }, [
        "Kafé Exempel · Exempelgatan 12 · 123 45 Exempelstad · Öppet 07–18 alla dagar",
        '<a href="[Avregistrera]">Avregistrera</a>',
      ]),
    ],
    {
      width: 600,
      backgroundColor: "#e8edf1",
      contentBackgroundColor: "#ffffff",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: 16,
      lineHeight: 1.65,
      textColor: ink,
      linkColor: accent,
      preheader: "Långsamt bryggd över natten. I baren från på fredag.",
    },
  );
}
