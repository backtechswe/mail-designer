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
