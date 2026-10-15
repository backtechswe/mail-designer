/**
 * Dark mode, which is three mechanisms because the clients do three different things:
 * a media query for Apple Mail, `[data-ogsc]`/`[data-ogsb]` attributes for Outlook.com, and
 * for Gmail simply having set the colours at all.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { toHtml } from "../dist/render/toHtml.js";
import { inspectEmail } from "../dist/render/inspect.js";
import { emptyDocument } from "../dist/document.js";

const DARK = {
  backgroundColor: "#0b0f14",
  contentBackgroundColor: "#151b23",
  textColor: "#e6edf3",
  linkColor: "#7cc2ff",
};

function withDark(dark = DARK) {
  const doc = emptyDocument();
  return { ...doc, settings: { ...doc.settings, dark } };
}

test("a document without dark settings emits nothing about dark mode", () => {
  // Bytes count against Gmail's clipping limit, and an unused class in every mail is noise.
  const { html } = toHtml(emptyDocument());
  assert.doesNotMatch(html, /color-scheme/);
  assert.doesNotMatch(html, /prefers-color-scheme/);
  assert.doesNotMatch(html, /md-dark/);
  assert.doesNotMatch(html, /data-ogs[bc]/);
});

test("both meta tags are present, because Apple Mail needs both", () => {
  const { html } = toHtml(withDark());
  assert.match(html, /<meta name="color-scheme" content="light dark" \/>/);
  assert.match(html, /<meta name="supported-color-schemes" content="light dark" \/>/);
  // Without color-scheme on :root, Apple Mail treats the message as light-only and applies
  // its own inversion instead of the rules below.
  assert.match(html, /:root\{color-scheme:light dark;supported-color-schemes:light dark\}/);
});

test("the media query carries every colour that was given", () => {
  const { html } = toHtml(withDark());
  const query = /@media \(prefers-color-scheme:dark\)\{([^}]*\}[^@]*)\}/.exec(html)?.[1] ?? "";
  assert.match(query, /md-dark-page\{background-color:#0b0f14!important\}/);
  assert.match(query, /md-dark-surface\{background-color:#151b23!important\}/);
  assert.match(query, /md-dark-text.*color:#e6edf3!important/);
  assert.match(query, /md-dark-link a\{color:#7cc2ff!important\}/);
});

test("text colour reaches the blocks, which set their own colour inline", () => {
  // A heading emits `color:` inline, and inline beats a class — unless the selector also
  // matches the descendants and says !important.
  const { html } = toHtml(withDark());
  assert.match(html, /\.md-dark-text,\.md-dark-text \*\{color:#e6edf3!important\}/);
});

test("Outlook.com is addressed through the attributes it rewrites, not a media query", () => {
  // It copies bgcolor to data-ogsb and colour styles to data-ogsc, then restyles from those,
  // and it ignores prefers-color-scheme entirely.
  const { html } = toHtml(withDark());
  assert.match(html, /\[data-ogsb\] \.md-dark-page\{background-color:#0b0f14!important\}/);
  assert.match(html, /\[data-ogsc\] \.md-dark-text/);
});

test("a partial dark block emits only what it defines", () => {
  const { html } = toHtml(withDark({ backgroundColor: "#000000" }));
  assert.match(html, /md-dark-page\{background-color:#000000!important\}/);
  assert.doesNotMatch(html, /md-dark-surface/);
  // No rule for a link colour, so no class for one either: a class with nothing behind it is
  // markup in every mail that does nothing.
  assert.doesNotMatch(html, /class="[^"]*md-dark-link/);
  assert.doesNotMatch(html, /class="[^"]*md-dark-text/);
});

test("an empty dark block turns the machinery on without asserting a colour", () => {
  // `{}` is a document saying "I have thought about this"; it should not emit dead rules.
  const { html } = toHtml(withDark({}));
  assert.doesNotMatch(html, /prefers-color-scheme/);
  assert.match(html, /<meta name="color-scheme"/, "the meta tags still declare the intent");
});

test("the page background carries bgcolor as well as the style", () => {
  // Older Outlook and some gateways drop background-color from a cell but honour the
  // attribute. The page background was the one that fell back to white in exactly those.
  const { html } = toHtml(emptyDocument());
  assert.match(html, /width="100%" bgcolor="#f5f5f7" style="width:100%;background-color:#f5f5f7"/);
});

test("a section with its own background keeps it in dark mode", () => {
  // A coloured band is usually the one thing meant to stay; overriding it would throw away a
  // deliberate choice.
  const doc = withDark();
  const section = { ...doc.blocks[0], backgroundColor: "#ff5500" };
  const { html } = toHtml({ ...doc, blocks: [section] });
  // The rule may exist in the stylesheet; what matters is that no element carries it.
  assert.doesNotMatch(html, /class="md-dark-surface"/);
  assert.match(html, /#ff5500/);
});

test("a mail with no dark treatment is reported, once", () => {
  const doc = emptyDocument();
  const warnings = inspectEmail(doc, toHtml(doc));
  assert.equal(warnings.filter((w) => w.id === "no-dark-mode").length, 1);

  const dark = withDark();
  assert.equal(
    inspectEmail(dark, toHtml(dark)).filter((w) => w.id === "no-dark-mode").length,
    0,
  );
});

test("the dark hooks sit on the sections, not on <body>", () => {
  // `.md-dark-text *` from <body> reaches every section in the document, including the ones
  // dark mode is meant to leave alone. Where the class hangs is the whole fix.
  const { html } = toHtml(withDark());
  const body = /<body[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(body, /class="md-dark-page"/, "the page background still belongs to the body");
  assert.doesNotMatch(body, /md-dark-text|md-dark-link/);
  assert.match(html, /class="md-dark-surface md-dark-text md-dark-link"/);
});

test("a section that paints itself is left alone entirely, text included", () => {
  // The bug this replaces: the section kept its light band — correctly, it is a deliberate
  // choice — and then `.md-dark-text *` painted the text on it light as well. Every tinted
  // section was unreadable in dark mode, and nothing in the editor showed it.
  const doc = withDark();
  const tinted = { ...doc.blocks[0], backgroundColor: "#ffe9c7" };
  const { html } = toHtml({ ...doc, blocks: [tinted] });
  // The rules stay in the stylesheet; what matters is that no element carries the hooks.
  // The page background is still the body's, and unrelated to this section.
  assert.doesNotMatch(html, /class="[^"]*md-dark-(surface|text|link)/);
  assert.match(html, /#ffe9c7/);
});

test("a full-width section still takes the text treatment when it sets no colour", () => {
  // fullWidth only decides which table carries the background. With no colour of its own the
  // section shows the page background, which dark mode does change — so its text must follow.
  const doc = withDark();
  const wide = { ...doc.blocks[0], fullWidth: true };
  const { html } = toHtml({ ...doc, blocks: [wide] });
  assert.match(html, /class="md-dark-text md-dark-link"/);
  assert.doesNotMatch(
    html,
    /class="[^"]*md-dark-surface/,
    "there is no inner surface to recolour",
  );
});

/* ------------------------------------------------- light and dark image variants */

import { extractDataFields } from "../dist/render/dataFields.js";

const LOGO = {
  id: "logo",
  type: "image",
  src: "https://example.com/violet.png",
  alt: "Bandcloud",
  align: "left",
  width: 140,
};

function withImage(image, dark = DARK) {
  const doc = dark ? withDark(dark) : emptyDocument();
  return { ...doc, blocks: [{ ...doc.blocks[0], children: [image] }] };
}

const imgs = (html) => [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);

test("an image without variants renders exactly one img and no swap rules", () => {
  const { html } = toHtml(withImage(LOGO));
  assert.equal(imgs(html).length, 1);
  assert.doesNotMatch(html, /md-swap|md-img-/);
  assert.doesNotMatch(html, /prefers-color-scheme:light/);
});

test("both variants: the fallback stays visible and gives way to each in turn", () => {
  const { html } = toHtml(withImage({ ...LOGO, lightSrc: "https://example.com/black.png", darkSrc: "https://example.com/white.png" }));
  const [fallback, light, dark] = imgs(html);
  assert.match(fallback, /src="https:\/\/example\.com\/violet\.png"/);
  assert.match(fallback, /class="md-swap-l md-swap-d"/);
  assert.match(fallback, /display:block/);
  assert.match(light, /src="https:\/\/example\.com\/black\.png"[^>]*class="md-img-l"/);
  assert.match(dark, /src="https:\/\/example\.com\/white\.png"[^>]*class="md-img-d"/);
  for (const variant of [light, dark]) {
    // Hidden three ways, because clients disagree about which they keep.
    assert.match(variant, /display:none;[^"]*max-height:0;overflow:hidden;mso-hide:all/);
    // The swap changes the picture, not the layout.
    assert.match(variant, /width="140"/);
    assert.match(variant, /alt="Bandcloud"/);
  }
});

test("the variants are invisible to Outlook for Windows", () => {
  const { html } = toHtml(withImage({ ...LOGO, lightSrc: "https://example.com/black.png", darkSrc: "https://example.com/white.png" }));
  const hidden = /<!--\[if !mso\]><!-->(.*?)<!--<!\[endif\]-->/s.exec(html)?.[1] ?? "";
  assert.equal(imgs(hidden).length, 2);
  assert.doesNotMatch(hidden, /violet\.png/, "the fallback is outside the conditional");
});

test("each branch is a media query, and Outlook.com's dark mode is reached through data-ogsb", () => {
  const { html } = toHtml(withImage({ ...LOGO, lightSrc: "https://example.com/black.png", darkSrc: "https://example.com/white.png" }));
  assert.match(html, /@media \(prefers-color-scheme:light\)\{\.md-swap-l\{display:none!important\}\.md-img-l\{display:block!important;max-height:none!important;overflow:visible!important\}\}/);
  assert.match(html, /@media \(prefers-color-scheme:dark\)\{\.md-swap-d\{display:none!important\}\.md-img-d\{display:block!important/);
  assert.match(html, /\[data-ogsb\] \.md-swap-d\{display:none!important\}\[data-ogsb\] \.md-img-d\{display:block!important/);
});

test("an image with only a dark variant keeps its fallback in light mode", () => {
  const { html } = toHtml(withImage({ ...LOGO, darkSrc: "https://example.com/white.png" }));
  assert.match(imgs(html)[0], /class="md-swap-d"/);
  assert.doesNotMatch(html, /md-swap-l|md-img-l|prefers-color-scheme:light/);
});

test("without dark colours the dark variant is left out, and the inspector says so", () => {
  // The mail stays light in Apple Mail without them, and a white logo would land on white.
  const doc = withImage({ ...LOGO, darkSrc: "https://example.com/white.png" }, null);
  const result = toHtml(doc);
  assert.equal(imgs(result.html).length, 1);
  assert.doesNotMatch(result.html, /md-swap|md-img-|white\.png/);
  const warning = inspectEmail(doc, result).find((w) => w.id === "dark-image-without-dark-mode");
  assert.deepEqual(warning?.blocks, ["logo"]);
});

test("a light variant works without dark colours", () => {
  const { html } = toHtml(withImage({ ...LOGO, lightSrc: "https://example.com/black.png" }, null));
  assert.equal(imgs(html).length, 2);
  assert.match(html, /prefers-color-scheme:light/);
  assert.doesNotMatch(html, /color-scheme" content/, "no dark treatment is declared");
});

test("a linked image links every variant", () => {
  const { html } = toHtml(withImage({ ...LOGO, href: "https://example.com/", lightSrc: "https://example.com/black.png", darkSrc: "https://example.com/white.png" }));
  assert.equal([...html.matchAll(/<a href="https:\/\/example\.com\/"[^>]*><img /g)].length, 3);
});

test("an unsafe or embedded variant is refused like an unsafe src", () => {
  const doc = withImage({ ...LOGO, lightSrc: "javascript:alert(1)", darkSrc: "data:image/png;base64,AAAA" });
  const result = toHtml(doc);
  assert.doesNotMatch(result.html, /javascript:|md-img-l/);
  assert.ok(inspectEmail(doc, result).some((w) => w.id === "data-uri-image"), "Gmail refuses data: in any of the three");
});

test("a data field can name the variant, and is substituted there", () => {
  const doc = withImage({ ...LOGO, darkSrc: "https://example.com/[Logo].png" });
  assert.ok(extractDataFields(doc).includes("Logo"));
  const { html } = toHtml(doc, { data: { Logo: "white" } });
  assert.match(html, /src="https:\/\/example\.com\/white\.png"[^>]*class="md-img-d"/);
});
