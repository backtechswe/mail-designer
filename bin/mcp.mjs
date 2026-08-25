/**
 * An MCP server, so an agent can design mail without a shell and without this repo.
 *
 * It ships as a subcommand of the CLI rather than as a package of its own, which makes the
 * whole installation one line in a client's config:
 *
 *   { "mail-designer": { "command": "npx", "args": ["-y", "@backtech/mail-designer", "mcp"] } }
 *
 * The tools are chosen around one loop: learn the shape (`get_schema`, `get_preset`), write a
 * document, and check it (`check_document`). Checking is the part an agent cannot do for
 * itself — email HTML is a domain where plausible markup breaks in exactly one client, and a
 * document that renders to 140 kB is fine everywhere except Gmail, where it is truncated.
 *
 * Transport is newline-delimited JSON-RPC 2.0 over stdio, hand-rolled: the protocol needs
 * three methods, and an SDK would be a dependency and a version to track. **stdout is the
 * transport** — anything else written there corrupts the session, which is why every
 * diagnostic in this file goes to stderr.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { version } = require_("../package.json");

const dist = (path) => import(new URL(`../dist/${path}`, import.meta.url).href);
const local = (path) => new URL(`../${path}`, import.meta.url);

/** The newest protocol revision we have been written against. */
const PROTOCOL = "2025-06-18";
const KNOWN = new Set([PROTOCOL, "2025-03-26", "2024-11-05"]);

const DOCUMENT_SCHEMA = {
  type: "object",
  description: "A MailDocument v1. Call get_schema for the full shape, or get_preset for one to modify.",
};

const TOOLS = [
  {
    name: "list_presets",
    description:
      "The built-in starting points, with their ids. Start here: modifying a preset is far " +
      "more reliable than writing a document from nothing.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_preset",
    description:
      "One starting point as a MailDocument. A worked example of every convention the " +
      "renderer expects — copy it and change the content.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "A preset id from list_presets." } },
      required: ["id"],
    },
  },
  {
    name: "get_schema",
    description:
      "The JSON Schema for a MailDocument v1, and the authoring notes that go with it: what " +
      "each block type needs, and the rules the renderer will not fix for you.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "check_document",
    description:
      "Validate a document and report what is wrong with the email it would produce: " +
      "structural errors, size against Gmail's 102 kB clipping limit, images without alt " +
      "text, content wider than the mail, a missing plain-text alternative or preheader. " +
      "Call this on every document you write — it is the only feedback available without a " +
      "mail client.",
    inputSchema: {
      type: "object",
      properties: { document: DOCUMENT_SCHEMA },
      required: ["document"],
    },
  },
  {
    name: "render_document",
    description:
      "Render a document to email HTML, or to the plain-text alternative that should be sent " +
      "beside it. Optionally substitutes sample values for [Bracketed] data fields.",
    inputSchema: {
      type: "object",
      properties: {
        document: DOCUMENT_SCHEMA,
        format: { type: "string", enum: ["html", "text"], description: "Default html." },
        data: {
          type: "object",
          description: "Values for [Bracketed] tokens, e.g. {\"Namn\": \"Anna\"}.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["document"],
    },
  },
  {
    name: "extract_fields",
    description:
      "Every [Bracketed] data field the document uses, including the ones inside link URLs — " +
      "which is what the sending application has to supply per recipient.",
    inputSchema: {
      type: "object",
      properties: { document: DOCUMENT_SCHEMA },
      required: ["document"],
    },
  },
];

/** Validates first, always: nothing downstream should ever see a malformed document. */
async function validated(document) {
  const { validateDocument } = await dist("validate.js");
  const result = validateDocument(document);
  if (result.ok) return null;
  return {
    ok: false,
    issues: result.issues,
    hint: "Fix these and call check_document again. get_schema describes the shape.",
  };
}

async function callTool(name, args) {
  switch (name) {
    case "list_presets": {
      const { builtInPresets } = await dist("presets/index.js");
      return builtInPresets.map((preset) => ({ id: preset.id, name: preset.name }));
    }

    case "get_preset": {
      const { builtInPresets } = await dist("presets/index.js");
      const preset = builtInPresets.find((p) => p.id === args?.id);
      if (!preset) {
        return {
          error: `No preset "${args?.id}".`,
          available: builtInPresets.map((p) => p.id),
        };
      }
      return preset.document;
    }

    case "get_schema": {
      const schema = JSON.parse(readFileSync(local("schema/mail-document.v1.json"), "utf8"));
      let notes = "";
      try {
        notes = readFileSync(local("docs/authoring.md"), "utf8");
      } catch {
        notes = "";
      }
      return { schema, notes };
    }

    case "check_document": {
      const invalid = await validated(args?.document);
      if (invalid) return invalid;
      const { toHtml } = await dist("render/toHtml.js");
      const { inspectEmail, emailSize, GMAIL_CLIP_BYTES } = await dist("render/inspect.js");
      const result = toHtml(args.document, {});
      const warnings = inspectEmail(args.document, result);
      return {
        ok: true,
        bytes: emailSize(result.html),
        clipLimit: GMAIL_CLIP_BYTES,
        warnings,
        fieldsUsed: (await dist("render/dataFields.js")).extractDataFields(args.document),
      };
    }

    case "render_document": {
      const invalid = await validated(args?.document);
      if (invalid) return invalid;
      const { toHtml } = await dist("render/toHtml.js");
      const result = toHtml(args.document, args?.data ? { data: args.data } : {});
      return args?.format === "text" ? result.text : result.html;
    }

    case "extract_fields": {
      const invalid = await validated(args?.document);
      if (invalid) return invalid;
      const { extractDataFields } = await dist("render/dataFields.js");
      return extractDataFields(args.document);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(message) {
  const { id, method, params } = message;
  // Notifications have no id and must not be answered at all.
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      reply(id, {
        protocolVersion: KNOWN.has(asked) ? asked : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mail-designer", version },
      });
      return;
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return;

    case "ping":
      if (isRequest) reply(id, {});
      return;

    case "tools/list":
      reply(id, { tools: TOOLS });
      return;

    case "tools/call": {
      const name = params?.name;
      try {
        const value = await callTool(name, params?.arguments ?? {});
        const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        reply(id, { content: [{ type: "text", text }] });
      } catch (error) {
        // A failed tool is a result, not a protocol error: the agent should see the message
        // and try something else, not have its request rejected.
        reply(id, {
          content: [{ type: "text", text: `${error.message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
  }
}

export function serve() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        replyError(null, -32700, "Parse error");
        continue;
      }
      void handle(message).catch((error) => {
        if (message?.id !== undefined) replyError(message.id, -32603, error.message);
      });
    }
  });
  process.stdin.on("end", () => process.exit(0));
  process.stderr.write(`mail-designer ${version} — MCP server on stdio\n`);
}
