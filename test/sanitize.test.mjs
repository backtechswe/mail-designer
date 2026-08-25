import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeInline, sanitizeBlock, stripTags } from "../dist/render/index.js";

test("script, style and iframe are removed with their contents", () => {
  assert.equal(sanitizeBlock("a<script>alert(1)</script>b"), "ab");
  assert.equal(sanitizeBlock("a<style>body{}</style>b"), "ab");
  assert.equal(sanitizeBlock('a<iframe src="x"></iframe>b'), "ab");
  // An unclosed opener must not survive by escaping the paired pattern.
  assert.equal(sanitizeBlock("a<script src=x>b"), "ab");
});

test("event handlers are stripped even on allowed tags and attributes", () => {
  assert.equal(sanitizeInline('<a href="https://x.se" onclick="evil()">x</a>'), '<a href="https://x.se">x</a>');
  assert.equal(sanitizeInline('<span onmouseover="evil()">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<b ONLOAD="evil()">x</b>'), "<b>x</b>");
});

test("executable URL schemes are dropped from href and src", () => {
  assert.equal(sanitizeInline('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeInline('<a href="JavaScript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeInline('<a href=" vbscript:x">y</a>'), "<a>y</a>");
  assert.equal(sanitizeBlock('<img src="javascript:alert(1)" />'), "<img />");
});

test("the old IE style-attribute vectors are dropped", () => {
  assert.equal(sanitizeInline('<span style="width:expression(alert(1))">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<span style="background:url(javascript:alert(1))">x</span>'), "<span>x</span>");
  assert.equal(sanitizeInline('<span style="color:red">x</span>'), '<span style="color:red">x</span>');
});

test("unknown tags go but their text stays", () => {
  assert.equal(sanitizeInline("<marquee>Hej</marquee>"), "Hej");
  assert.equal(sanitizeInline("<div>Hej</div>"), "Hej", "div is not inline-allowed");
  assert.equal(sanitizeBlock("<div>Hej</div>"), "<div>Hej</div>", "but it is allowed in a raw block");
});

test("permitted formatting survives untouched", () => {
  const input = '<p style="color:red"><b>fet</b> <i>kursiv</i><br /><a href="https://x.se" target="_blank">länk</a></p>';
  assert.equal(sanitizeInline(input), input);
});

test("comments are removed, including MSO ones an author pasted in", () => {
  assert.equal(sanitizeBlock("a<!--[if mso]>x<![endif]-->b"), "ab");
});

test("attributes not on the whitelist are dropped", () => {
  assert.equal(sanitizeBlock('<td width="50%" bogus="1">x</td>'), '<td width="50%">x</td>');
});

test("stripTags turns markup into readable text", () => {
  assert.equal(stripTags("<p>Ett</p><p>Två</p>"), "Ett\nTvå");
  assert.equal(stripTags("Rad<br />Rad2"), "Rad\nRad2");
  assert.equal(stripTags("<ul><li>A</li><li>B</li></ul>"), "A\nB");
  assert.equal(stripTags("Tre&nbsp;ord &amp; mer"), "Tre ord & mer");
  assert.equal(stripTags("<script>evil()</script>Text"), "Text");
});
