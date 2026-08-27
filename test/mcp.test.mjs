/**
 * The MCP server, over its real transport.
 *
 * Spawned as a process and spoken to in JSON-RPC, because the things that break an MCP server
 * are transport-level: a stray write to stdout, an answered notification, a tool error thrown
 * as a protocol error. None of those show up if you call the handlers directly.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/mail-designer.mjs", import.meta.url));

/** Sends the messages, resolves with every response line, in order. */
function session(messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, "mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", () => {
      const lines = out.split("\n").filter((line) => line.trim());
      try {
        resolve({ responses: lines.map((line) => JSON.parse(line)), stderr: err });
      } catch (error) {
        reject(new Error(`${error.message}\nstdout was:\n${out}`));
      }
    });
    for (const message of messages) {
      // A raw string is written as-is, so a test can send something that is not JSON at all.
      const line = typeof message === "string" ? message : JSON.stringify(message);
      child.stdin.write(`${line}\n`);
    }
    child.stdin.end();
  });
}

const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };
const call = (id, name, args = {}) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

/** The tool's payload, parsed if it is JSON. */
const payload = (response) => {
  const text = response.result.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const DOC = {
  version: 1,
  settings: { preheader: "Hi [Name]" },
  blocks: [
    {
      id: "s",
      type: "section",
      children: [{ id: "t", type: "text", html: "<p>Hi [Name]</p>", align: "left" }],
    },
  ],
};

test("initialize answers with the protocol version the client asked for", async () => {
  const { responses } = await session([init]);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].result.protocolVersion, "2025-06-18");
  assert.equal(responses[0].result.serverInfo.name, "mail-designer");
  assert.ok(responses[0].result.capabilities.tools);
});

test("an unknown protocol version falls back to one we implement", async () => {
  const { responses } = await session([
    { ...init, params: { protocolVersion: "1999-01-01" } },
  ]);
  assert.match(responses[0].result.protocolVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(responses[0].result.protocolVersion, "1999-01-01");
});

test("notifications are not answered", async () => {
  const { responses } = await session([
    init,
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ]);
  assert.equal(responses.length, 1, "the notification must produce no response at all");
});

test("nothing but JSON-RPC is ever written to stdout", async () => {
  const { responses, stderr } = await session([init, call(2, "list_presets")]);
  assert.equal(responses.length, 2);
  for (const response of responses) assert.equal(response.jsonrpc, "2.0");
  assert.match(stderr, /MCP server on stdio/, "diagnostics belong on stderr");
});

test("tools/list describes every tool with an input schema", async () => {
  const { responses } = await session([init, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);
  const { tools } = responses[1].result;
  const names = tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "check_document",
    "extract_fields",
    "get_preset",
    "get_schema",
    "list_presets",
    "render_document",
  ]);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    assert.ok(tool.description.length > 40, `${tool.name} needs a real description`);
  }
});

test("get_preset returns a document check_document then accepts", async () => {
  const { responses } = await session([init, call(2, "get_preset", { id: "newsletter" })]);
  const document = payload(responses[1]);
  assert.equal(document.version, 1);

  const second = await session([init, call(2, "check_document", { document })]);
  const report = payload(second.responses[1]);
  assert.equal(report.ok, true);
  assert.ok(report.bytes > 0);
  assert.equal(report.clipLimit, 102400);
});

test("an unknown preset answers with the ones that exist", async () => {
  const { responses } = await session([init, call(2, "get_preset", { id: "nyhetsbrev" })]);
  const result = payload(responses[1]);
  assert.match(result.error, /nyhetsbrev/);
  assert.ok(result.available.includes("newsletter"));
});

test("check_document on a malformed document explains what to fix", async () => {
  const { responses } = await session([
    init,
    call(2, "check_document", { document: { version: 4 } }),
  ]);
  const report = payload(responses[1]);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.path === "version"));
  assert.match(report.hint, /get_schema/);
});

test("render_document renders, and substitutes data when given some", async () => {
  const { responses } = await session([
    init,
    call(2, "render_document", { document: DOC }),
    call(3, "render_document", { document: DOC, data: { Name: "Anna" } }),
    call(4, "render_document", { document: DOC, format: "text" }),
  ]);
  const [, raw, filled, text] = responses;
  assert.match(payload(raw), /^<!DOCTYPE/);
  assert.match(payload(raw), /\[Name\]/);
  assert.match(payload(filled), /Hi Anna/);
  assert.ok(!payload(text).includes("<table"));
});

test("get_schema carries the authoring notes with it", async () => {
  const { responses } = await session([init, call(2, "get_schema")]);
  const result = payload(responses[1]);
  assert.equal(result.schema.title, "MailDocument v1");
  assert.match(result.notes, /Gmail clips/);
});

test("extract_fields finds tokens, including in a preheader", async () => {
  const { responses } = await session([init, call(2, "extract_fields", { document: DOC })]);
  assert.deepEqual(payload(responses[1]), ["Name"]);
});

test("an unknown tool is a tool error, not a protocol error", async () => {
  const { responses } = await session([init, call(2, "frobnicate")]);
  assert.equal(responses[1].error, undefined, "the request itself succeeded");
  assert.equal(responses[1].result.isError, true);
  assert.match(responses[1].result.content[0].text, /Unknown tool/);
});

test("an unknown method is a proper JSON-RPC error", async () => {
  const { responses } = await session([init, { jsonrpc: "2.0", id: 2, method: "nope/nope" }]);
  assert.equal(responses[1].error.code, -32601);
});

test("a malformed line does not take the session down", async () => {
  const { responses } = await session([init, "not json", call(3, "list_presets")]);
  const ids = responses.map((response) => response.id);
  assert.ok(ids.includes(3), "the session continued past the bad line");
  assert.ok(responses.some((response) => response.error?.code === -32700));
});

/* ------------------------------------------ the three the commit message claimed were tested */

test("a response larger than the pipe buffer arrives whole", async () => {
  // The failure this guards: `process.exit` on stdin end discards whatever stdout still has
  // queued. Measured at 65 361 bytes of a 245 kB response, with exit code 0 — so a client saw
  // a truncated message and a clean shutdown. Email HTML passes 64 kB routinely.
  const src = (await import("../dist/presets/index.js")).builtInPresets[0].document;
  const blocks = [];
  for (let i = 0; i < 16; i += 1) {
    for (const block of src.blocks) blocks.push({ ...structuredClone(block), id: `${block.id}_${i}` });
  }
  const document = { ...src, blocks };

  const { responses } = await session([init, call(2, "render_document", { document })]);
  const html = payload(responses[1]);
  assert.ok(html.length > 100_000, `response was only ${html.length} bytes`);
  assert.match(html, /<\/html>\s*$/, "the HTML is complete, not cut off mid-document");
});

test("no branch answers a notification", async () => {
  // Three of six used to reply unconditionally, and JSON.stringify drops an undefined id — so
  // the client received a message with neither an id nor a method.
  const notifications = [
    { jsonrpc: "2.0", method: "initialize", params: {} },
    { jsonrpc: "2.0", method: "tools/list" },
    { jsonrpc: "2.0", method: "tools/call", params: { name: "list_presets", arguments: {} } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", method: "ping" },
  ];
  const { responses } = await session([init, ...notifications]);
  assert.equal(responses.length, 1, "only the initialize *request* may be answered");
  for (const response of responses) {
    assert.ok(response.id !== undefined && response.id !== null, "every message carries an id");
  }
});

test("a batch is refused rather than dropped", async () => {
  // Batching is legal in every version this server advertises and is not implemented. Silence
  // left a batching client waiting forever.
  const { responses } = await session([init, [call(2, "list_presets"), call(3, "list_presets")]]);
  assert.ok(responses.some((r) => r.error?.code === -32600));
});

test("tools/call without a tool name is a protocol error, not a tool error", async () => {
  const { responses } = await session([
    init,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { arguments: {} } },
  ]);
  assert.equal(responses[1].error.code, -32602);
});
