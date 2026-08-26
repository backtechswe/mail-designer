/**
 * The pretty-printer. Its one hard rule is that it may add whitespace only where whitespace
 * is insignificant — a newline in inline content collapses to a space in the mail, which is a
 * visible change to something already sent to thousands of people.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { formatHtml } from "../dist/render/format.js";
import { toHtml } from "../dist/render/toHtml.js";
import { builtInPresets } from "../dist/presets/index.js";

/**
 * Newlines inside <style> are CSS text, where whitespace means nothing. Everywhere else a
 * newline must sit between two tags — that is the formatter's whole promise.
 */
function styleRanges(html) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  for (let m; (m = re.exec(html)); ) out.push([m.index, m.index + m[0].length]);
  return out;
}

/**
 * Every newline the formatter added is between `>` and `<`, or inside CSS.
 *
 * This replaces a normalisation that could not fail: the old check erased a newline plus any
 * following whitespace anywhere it appeared, so "Hej\n , då" and "Hej, då" came out
 * identical — and the assertion passed for precisely the bug it existed to catch.
 */
function assertBreaksBetweenTags(html, label) {
  const ranges = styleRanges(html);
  for (const match of html.matchAll(/\n\s*/g)) {
    if (ranges.some(([from, to]) => match.index > from && match.index < to)) continue;
    const before = html[match.index - 1];
    const after = html[match.index + match[0].length];
    assert.ok(
      before === ">" && after === "<",
      `${label}: a line break inside content renders as a space — ...${html.slice(
        Math.max(0, match.index - 40),
        match.index + 20,
      )}...`,
    );
  }
}

/** Undo exactly what the formatter is allowed to do: whitespace between tags. */
const collapse = (html) => html.replace(/>\s+</g, "><").replace(/\n\s*/g, "");

test("formatting every preset changes nothing but whitespace between tags", () => {
  for (const preset of builtInPresets) {
    const html = toHtml(preset.document).html;
    const formatted = formatHtml(html);
    assert.equal(collapse(formatted), collapse(html), preset.id);
    assertBreaksBetweenTags(formatted, preset.id);
  }
});

test("a comment in inline content is never broken away from it", () => {
  // <td>Hej<!-- x -->då</td> across lines renders as "Hej då": the newline collapses to a
  // space. The commit that added this formatter claimed to guard the invariant and did not.
  const cases = [
    "<td>Hej<!-- x -->då</td>",
    // The downgrade-revealing Outlook pattern, which is exactly this shape.
    "<td><!--[if !mso]><!-->text<!--<![endif]--></td>",
    "<td>a<!--[if !mso]><!--><b>b</b><!--<![endif]-->c</td>",
  ];
  for (const html of cases) {
    assert.equal(formatHtml(html), html, html);
    assertBreaksBetweenTags(formatHtml(html), html);
  }
});

test("formatting is idempotent, comments included", () => {
  const cases = [
    "<td><!--[if mso]><table><![endif]--><div>x</div></td>",
    '<head><!-- k --><meta charset="utf-8" /></head>',
    "<td>Hej<!-- x -->då</td>",
    ...builtInPresets.map((p) => toHtml(p.document).html),
  ];
  for (const html of cases) {
    const once = formatHtml(html);
    assert.equal(formatHtml(once), once, html.slice(0, 60));
  }
});

test("inline content is never broken apart", () => {
  const html = '<td><a href="#">Läs</a>, och <b>mer</b> text</td>';
  // One line: a break anywhere in here would render as an extra space.
  assert.equal(formatHtml(html), '<td><a href="#">Läs</a>, och <b>mer</b> text</td>');
});

test("a space between two inline elements survives", () => {
  const html = "<td><b>a</b> <i>b</i></td>";
  assert.equal(formatHtml(html), "<td><b>a</b> <i>b</i></td>");
});

test("nested tables are indented one level per table", () => {
  const html = "<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>";
  assert.equal(
    formatHtml(html),
    [
      "<table>",
      "  <tr>",
      "    <td>",
      "      <table>",
      "        <tr>",
      "          <td>x</td>",
      "        </tr>",
      "      </table>",
      "    </td>",
      "  </tr>",
      "</table>",
    ].join("\n"),
  );
});

test("an MSO conditional stays on the line it was on", () => {
  // It would read better on its own line, and it cannot have one: a comment's position is
  // sometimes inline content, and the formatter cannot tell which case it is looking at
  // without knowing what comes next. Correctness first.
  const html = "<td><!--[if mso]><table><![endif]--><div>x</div></td>";
  assert.equal(
    formatHtml(html),
    ["<td><!--[if mso]><table><![endif]-->", "  <div>x</div>", "</td>"].join("\n"),
  );
});

test("an image stays with the text it sits beside", () => {
  const html = '<td>Före <img src="x.png" alt="" /> efter</td>';
  assert.equal(formatHtml(html), html);
});

test("head elements each take a line", () => {
  const html = '<head><meta charset="utf-8" /><title>Hej</title></head>';
  assert.equal(
    formatHtml(html),
    ["<head>", '  <meta charset="utf-8" />', "  <title>Hej</title>", "</head>"].join("\n"),
  );
});

test("the whole document round-trips through the formatter unchanged in meaning", () => {
  const html = toHtml(builtInPresets[0].document).html;
  const once = formatHtml(html);
  // Formatting formatted output must be a no-op, or the indentation grows every time the
  // code view re-renders.
  assert.equal(formatHtml(once), once);
});

test("it does not choke on an empty or a tagless string", () => {
  assert.equal(formatHtml(""), "");
  assert.equal(formatHtml("bara text"), "bara text");
});
