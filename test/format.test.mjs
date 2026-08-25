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

/** Undo exactly what the formatter is allowed to do: whitespace between tags. */
const collapse = (html) => html.replace(/>\s+</g, "><").replace(/\n\s*/g, "");

test("formatting every preset changes nothing but whitespace between tags", () => {
  for (const preset of builtInPresets) {
    const html = toHtml(preset.document).html;
    assert.equal(collapse(formatHtml(html)), collapse(html), preset.id);
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

test("an MSO conditional gets its own line and does not shift the indentation", () => {
  const html = "<td><!--[if mso]><table><![endif]--><div>x</div></td>";
  assert.equal(
    formatHtml(html),
    ["<td>", "  <!--[if mso]><table><![endif]-->", "  <div>x</div>", "</td>"].join("\n"),
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
