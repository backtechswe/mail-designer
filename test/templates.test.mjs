import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSavable,
  createLocalStorageTemplateStore,
  createMemoryTemplateStore,
  createRestTemplateStore,
  parseTemplate,
  validateDocument,
  coerceDocument,
  emptyDocument,
  createSection,
  createBlock,
} from "../dist/index.js";
import { setIdFactory } from "../dist/document.js";

setIdFactory((() => { let n = 0; return () => `t${++n}`; })());

test("a memory store round-trips a template and lists it without the document", async () => {
  const store = createMemoryTemplateStore();
  const saved = await store.save({ name: "  Nyhetsbrev  ", document: emptyDocument() });

  assert.ok(saved.id);
  assert.equal(saved.name, "Nyhetsbrev", "the name is trimmed");
  assert.ok(saved.createdAt && saved.updatedAt);

  const list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].document, undefined, "listing stays cheap");

  const loaded = await store.load(saved.id);
  assert.equal(loaded.name, "Nyhetsbrev");
  assert.equal(loaded.document.version, 1);
  assert.equal(loaded.document.blocks.length, 1);

  await store.remove(saved.id);
  assert.equal(await store.load(saved.id), null);
  assert.deepEqual(await store.list(), []);
});

test("saving with an existing id overwrites but keeps createdAt", async () => {
  const store = createMemoryTemplateStore();
  const first = await store.save({ name: "A", document: emptyDocument() });
  const second = await store.save({ id: first.id, name: "B", document: emptyDocument() });

  assert.equal(second.id, first.id);
  assert.equal(second.name, "B");
  assert.equal(second.createdAt, first.createdAt);
  assert.equal((await store.list()).length, 1);
});

test("a memory store hands out copies, so a caller cannot mutate the stored document", async () => {
  const store = createMemoryTemplateStore();
  const doc = emptyDocument();
  const saved = await store.save({ name: "A", document: doc });

  doc.blocks = [];
  const loaded = await store.load(saved.id);
  assert.ok(loaded.document.blocks.length > 0, "mutating the input after save does not affect storage");

  loaded.document.blocks = [];
  const again = await store.load(saved.id);
  assert.ok(again.document.blocks.length > 0, "mutating a loaded copy does not affect storage");
});

test("a nameless or structurally broken template is refused before it reaches storage", () => {
  assert.throws(() => assertSavable({ name: "  ", document: emptyDocument() }), /must have a name/);
  assert.throws(
    () => assertSavable({ name: "A", document: { version: 1, settings: {}, blocks: [createBlock("text")] } }),
    /Top-level blocks must be sections/,
  );
});

test("localStorage store works against an injected Storage and survives a corrupt blob", async () => {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
  const store = createLocalStorageTemplateStore({ storage, key: "k" });

  const saved = await store.save({ name: "A", document: emptyDocument() });
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.load(saved.id)).name, "A");

  map.set("k", "{not json");
  assert.deepEqual(await store.list(), [], "a corrupt blob reads as empty rather than throwing");
});

test("the REST store speaks the documented contract", async () => {
  const calls = [];
  const template = { id: "abc", name: "A", document: emptyDocument(), updatedAt: "2026-01-01T00:00:00.000Z" };

  const fakeFetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    if (url.endsWith("/missing")) return new Response("null", { status: 404 });
    if (url.endsWith("/templates")) {
      return new Response(JSON.stringify(init.method === "POST" ? template : [template]), { status: 200 });
    }
    return new Response(JSON.stringify(template), { status: 200 });
  };

  const store = createRestTemplateStore({ baseUrl: "https://api.test/templates/", fetch: fakeFetch });

  assert.equal((await store.list())[0].id, "abc");
  assert.equal((await store.load("abc")).name, "A");
  assert.equal(await store.load("missing"), null, "404 means absent, not an error");

  await store.save({ name: "New", document: emptyDocument() });
  await store.save({ id: "abc", name: "Upd", document: emptyDocument() });
  await store.remove("abc");

  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [
      "GET https://api.test/templates",
      "GET https://api.test/templates/abc",
      "GET https://api.test/templates/missing",
      "POST https://api.test/templates",
      "PUT https://api.test/templates/abc",
      "DELETE https://api.test/templates/abc",
    ],
  );
  // A create must not send an id; the server assigns it.
  assert.equal(JSON.parse(calls[3].body).id, undefined);
});

test("the REST store surfaces a server error rather than returning empty", async () => {
  const store = createRestTemplateStore({
    baseUrl: "https://api.test/templates",
    fetch: async () => new Response("boom", { status: 500, statusText: "Server Error" }),
  });
  await assert.rejects(() => store.list(), /svarade 500/);
});

test("parseTemplate repairs what it can and rejects what it cannot", () => {
  assert.equal(parseTemplate(null), null);
  assert.equal(parseTemplate({ name: "A" }), null, "no id means no template");

  const repaired = parseTemplate({ id: "x", document: { version: 1 } });
  assert.equal(repaired.name, "Untitled");
  assert.deepEqual(repaired.document.blocks, []);
  assert.equal(repaired.document.settings.width, 600, "missing settings are defaulted");
});

test("validateDocument reports the path of the first real problem", () => {
  assert.equal(validateDocument(emptyDocument()).ok, true);

  const wrongVersion = validateDocument({ version: 2, settings: {}, blocks: [] });
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.issues[0].message, /Unsupported document version/);

  const doc = emptyDocument();
  doc.blocks = [createSection([createBlock("columns")])];
  doc.blocks[0].children[0].columns[0].children = [createBlock("columns")];
  const nested = validateDocument(doc);
  assert.equal(nested.ok, false);
  assert.match(nested.issues[0].path, /columns\[0\]\.children\[0\]/);
  assert.match(nested.issues[0].message, /not allowed inside a column/);
});

test("coerceDocument always yields something the editor can open", () => {
  const fromNothing = coerceDocument(undefined);
  assert.equal(fromNothing.version, 1);
  assert.deepEqual(fromNothing.blocks, []);
  assert.equal(fromNothing.settings.width, 600);
});

test("parseTemplate refuses a row whose blocks are malformed", () => {
  // coerceDocument fills in missing top-level fields but spreads blocks through untouched,
  // so this is the case that used to reach the editor and the renderer.
  assert.equal(parseTemplate({ id: "x", document: { version: 1, settings: {}, blocks: "nope" } }), null);
  assert.equal(
    parseTemplate({ id: "x", document: { version: 1, settings: {}, blocks: [{ id: "a", type: "text" }] } }),
    null,
    "a leaf at the top level is not a section",
  );
  assert.equal(parseTemplate({ id: "x", document: { version: 7 } }), null, "wrong version");
});

/*
 * The code view's document tab is editable, so what it shows has to be something you can
 * paste back. That makes the round trip a contract rather than a nicety: serialise, parse,
 * validate, coerce, and the mail must be the one you started with — byte for byte, or the
 * feature quietly rewrites people's templates.
 */
test("every preset survives the trip through the document tab", async () => {
  const { builtInPresets } = await import("../dist/presets/index.js");
  const { toHtml } = await import("../dist/render/index.js");

  for (const preset of builtInPresets) {
    const shown = JSON.stringify(preset.document, null, 2);
    const parsed = JSON.parse(shown);

    const result = validateDocument(parsed);
    assert.equal(result.ok, true, `${preset.id}: ${JSON.stringify(result.issues)}`);

    const back = coerceDocument(parsed);
    assert.equal(toHtml(back).html, toHtml(preset.document).html, `${preset.id} html`);
    assert.equal(toHtml(back).text, toHtml(preset.document).text, `${preset.id} text`);
  }
});

test("a document the paste box would refuse is one the renderer could not draw", () => {
  // The pairing that matters: the box refuses exactly what validateDocument refuses, so a
  // document that gets in is one the canvas can open.
  const broken = {
    version: 1,
    settings: {},
    blocks: [{ id: "s", type: "section", children: [{ id: "b", type: "button", innerPadding: "nonsense" }] }],
  };
  const result = validateDocument(broken);
  assert.equal(result.ok, false);
  assert.match(result.issues[0].path, /innerPadding$/);
});
