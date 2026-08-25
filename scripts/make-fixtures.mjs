/**
 * Regenerates test/fixtures/*.json. Fixtures are checked in as plain JSON so they are
 * language-agnostic: a future .NET or Go renderer can read the same input and be held to
 * the same golden output without depending on this package.
 *
 *   node scripts/make-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createBlock,
  createColumn,
  createSection,
  emptyDocument,
  setIdFactory,
} from "../dist/document.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "test", "fixtures");
mkdirSync(outDir, { recursive: true });

function withIds(build) {
  let n = 0;
  setIdFactory(() => `id${++n}`);
  return build();
}

const set = (block, patch) => Object.assign(block, patch);

const minimal = withIds(() => {
  const doc = emptyDocument();
  doc.blocks = [createSection([set(createBlock("text"), { html: "Hej." })])];
  return doc;
});

const allBlocks = withIds(() => {
  const doc = emptyDocument();
  doc.settings.preheader = "Förhandsvisning för [Namn]";
  doc.blocks = [
    createSection([
      set(createBlock("heading"), { html: "Hej [Namn]!", level: 1 }),
      set(createBlock("heading"), { html: "Underrubrik", level: 3, align: "center" }),
      set(createBlock("text"), {
        html: "<p>Text med <b>fet</b>, <i>kursiv</i> och <a href='https://exempel.se'>länk</a>.</p><ul><li>Ett</li><li>Två</li></ul>",
      }),
      set(createBlock("image"), {
        src: "https://exempel.se/bild.png",
        alt: "En bild",
        href: "https://exempel.se",
        width: 300,
        borderRadius: 8,
      }),
      set(createBlock("button"), {
        label: "Boka tid",
        href: "https://exempel.se/boka?ref=[Namn]",
        width: 180,
      }),
      set(createBlock("button"), { label: "Utan bredd", href: "https://exempel.se" }),
      createBlock("divider"),
      createBlock("spacer"),
      set(createBlock("social"), {
        items: [
          { network: "facebook", href: "https://facebook.com/x", iconUrl: "https://cdn.exempel.se/fb.png" },
          { network: "instagram", href: "https://instagram.com/x", iconUrl: "https://cdn.exempel.se/ig.png" },
        ],
      }),
      set(createBlock("html"), { html: "<p>Rå <b>HTML</b> med <script>alert(1)</script> borttaget.</p>" }),
    ]),
    set(
      createSection([
        set(createBlock("columns"), {
          gap: 16,
          columns: [
            createColumn([set(createBlock("text"), { html: "Vänster" })], 33.33),
            createColumn([set(createBlock("text"), { html: "Mitten" })]),
            createColumn([set(createBlock("image"), { src: "https://exempel.se/h.png", alt: "H" })]),
          ],
        }),
        set(createBlock("columns"), {
          gap: 24,
          stackOnMobile: false,
          columns: [
            createColumn([set(createBlock("text"), { html: "A" })]),
            createColumn([set(createBlock("text"), { html: "B" })]),
          ],
        }),
      ]),
      { fullWidth: true, backgroundColor: "#eef2ff" },
    ),
  ];
  return doc;
});

for (const [name, doc] of Object.entries({ minimal, "all-blocks": allBlocks })) {
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
