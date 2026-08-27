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
  doc.settings.preheader = "Preview text for [Name]";
  doc.blocks = [
    createSection([
      set(createBlock("heading"), { html: "Hi [Name]!", level: 1 }),
      set(createBlock("heading"), { html: "Subheading", level: 3, align: "center" }),
      set(createBlock("text"), {
        html: "<p>Text with <b>bold</b>, <i>italic</i> and a <a href='https://example.com'>link</a>.</p><ul><li>One</li><li>Two</li></ul>",
      }),
      set(createBlock("image"), {
        src: "https://example.com/image.png",
        alt: "An image",
        href: "https://example.com",
        width: 300,
        borderRadius: 8,
      }),
      set(createBlock("button"), {
        label: "Book a time",
        href: "https://example.com/book?ref=[Name]",
        width: 180,
      }),
      set(createBlock("button"), { label: "No width", href: "https://example.com" }),
      createBlock("divider"),
      createBlock("spacer"),
      set(createBlock("social"), {
        items: [
          { network: "facebook", href: "https://facebook.com/x", iconUrl: "https://cdn.example.com/fb.png" },
          { network: "instagram", href: "https://instagram.com/x", iconUrl: "https://cdn.example.com/ig.png" },
        ],
      }),
      set(createBlock("html"), { html: "<p>Raw <b>HTML</b> with <script>alert(1)</script> removed.</p>" }),
    ]),
    set(
      createSection([
        set(createBlock("columns"), {
          gap: 16,
          columns: [
            createColumn([set(createBlock("text"), { html: "Left" })], 33.33),
            createColumn([set(createBlock("text"), { html: "Centre" })]),
            createColumn([set(createBlock("image"), { src: "https://example.com/r.png", alt: "H" })]),
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
