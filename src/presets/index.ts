import type {
  ButtonBlock,
  DividerBlock,
  HeadingBlock,
  ImageBlock,
  MailColumn,
  MailDocument,
  MailPreset,
  SectionBlock,
  SectionChild,
  SpacerBlock,
  Spacing,
  TextBlock,
} from "../types.js";
import { defaultSettings } from "../document.js";

/**
 * Starting points, written as TypeScript rather than JSON so `tsc` alone is the whole
 * build — no asset copying step, and every preset is type-checked against the document
 * model. Ids are literal and stable; the editor clones a preset with fresh ids when it is
 * applied, so two copies of the same preset never collide.
 *
 * Pass your own list through the `presets` prop to replace or extend these.
 */

let seq = 0;
const id = (): string => `p${++seq}`;

const heading = (html: string, patch: Partial<HeadingBlock> = {}): HeadingBlock => ({
  id: id(),
  type: "heading",
  level: 2,
  html,
  align: "left",
  padding: [0, 0, 12, 0],
  ...patch,
});

const text = (html: string, patch: Partial<TextBlock> = {}): TextBlock => ({
  id: id(),
  type: "text",
  html,
  align: "left",
  padding: [0, 0, 12, 0],
  ...patch,
});

const button = (label: string, href: string, patch: Partial<ButtonBlock> = {}): ButtonBlock => ({
  id: id(),
  type: "button",
  label,
  href,
  backgroundColor: "#2f54eb",
  textColor: "#ffffff",
  borderRadius: 6,
  fontSize: 16,
  innerPadding: [12, 24, 12, 24],
  align: "left",
  padding: [4, 0, 12, 0],
  ...patch,
});

const image = (patch: Partial<ImageBlock> = {}): ImageBlock => ({
  id: id(),
  type: "image",
  src: "",
  alt: "",
  align: "center",
  padding: [0, 0, 12, 0],
  ...patch,
});

const divider = (patch: Partial<DividerBlock> = {}): DividerBlock => ({
  id: id(),
  type: "divider",
  color: "#e5e5e5",
  thickness: 1,
  width: 100,
  align: "center",
  padding: [8, 0, 16, 0],
  ...patch,
});

const spacer = (height = 24): SpacerBlock => ({ id: id(), type: "spacer", height });

const column = (children: MailColumn["children"], width?: number): MailColumn => ({
  id: id(),
  children,
  ...(width === undefined ? {} : { width }),
});

const section = (children: SectionChild[], patch: Partial<SectionBlock> = {}): SectionBlock => ({
  id: id(),
  type: "section",
  padding: [32, 32, 32, 32] as Spacing,
  children,
  ...patch,
});

const doc = (blocks: SectionBlock[], settings: Partial<MailDocument["settings"]> = {}): MailDocument => ({
  version: 1,
  settings: { ...defaultSettings, ...settings },
  blocks,
});

const FOOTER_TEXT =
  '<p>Du får det här mejlet eftersom du är kund hos oss.</p>' +
  '<p><a href="[Avregistrera]">Avregistrera</a></p>';

const footer = (): SectionBlock =>
  section(
    [
      divider({ padding: [0, 0, 16, 0] }),
      text(FOOTER_TEXT, {
        align: "center",
        fontSize: 12,
        color: "#8c8c8c",
        padding: [0, 0, 0, 0],
      }),
    ],
    { padding: [16, 32, 24, 32] },
  );

export const builtInPresets: MailPreset[] = [
  {
    id: "blank",
    name: "Tomt",
    document: doc([section([text("Skriv din text här.")])]),
  },
  {
    id: "newsletter",
    name: "Nyhetsbrev",
    document: doc([
      section([image({ alt: "Logotyp", width: 140, padding: [0, 0, 0, 0] })], {
        padding: [24, 32, 24, 32],
      }),
      section([
        heading("Månadens nyheter", { level: 1 }),
        text("<p>Hej [Namn]! Här är det viktigaste sedan sist.</p>"),
        divider(),
        heading("Första artikeln", { level: 3 }),
        text("<p>En kort inledning som gör läsaren nyfiken nog att klicka.</p>"),
        button("Läs mer", "https://", { width: 160 }),
        divider(),
        {
          id: id(),
          type: "columns",
          gap: 24,
          stackOnMobile: true,
          columns: [
            column([image({ alt: "Bild" }), heading("Tips", { level: 3 }), text("<p>Kort text.</p>")]),
            column([image({ alt: "Bild" }), heading("Tips", { level: 3 }), text("<p>Kort text.</p>")]),
          ],
        },
      ]),
      footer(),
    ]),
  },
  {
    id: "invitation",
    name: "Inbjudan",
    document: doc(
      [
        section(
          [
            heading("Du är inbjuden", { level: 1, align: "center", color: "#ffffff" }),
            text('<p>Torsdag 12 mars, kl 18.00</p>', {
              align: "center",
              color: "#dbe3ff",
              fontSize: 18,
            }),
          ],
          { fullWidth: true, backgroundColor: "#2f54eb", padding: [48, 32, 48, 32] },
        ),
        section([
          text("<p>Hej [Namn],</p><p>Vi vill gärna se dig hos oss. Anmäl dig senast den 5 mars.</p>"),
          button("Anmäl mig", "https://", { align: "center", width: 200 }),
          spacer(8),
          text("<p>Adress: Storgatan 1, Kalmar</p>", { fontSize: 14, color: "#8c8c8c" }),
        ]),
        footer(),
      ],
      { backgroundColor: "#eef1fe" },
    ),
  },
  {
    id: "confirmation",
    name: "Bekräftelse",
    document: doc([
      section([
        heading("Tack, [Namn]!", { level: 1 }),
        text("<p>Vi har tagit emot din bokning. Här är detaljerna:</p>"),
        {
          id: id(),
          type: "columns",
          gap: 16,
          stackOnMobile: true,
          columns: [
            column([text("<p><b>Datum</b><br />[Datum]</p>")], 50),
            column([text("<p><b>Tid</b><br />[Tid]</p>")], 50),
          ],
        },
        divider(),
        text("<p>Behöver du ändra något? Svara på det här mejlet.</p>", {
          fontSize: 14,
          color: "#8c8c8c",
          padding: [0, 0, 0, 0],
        }),
      ]),
      footer(),
    ]),
  },
];

export function findPreset(presetId: string, presets: MailPreset[] = builtInPresets) {
  return presets.find((p) => p.id === presetId);
}
