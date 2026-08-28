#!/usr/bin/env node
/**
 * mail-designer on the command line.
 *
 * The point is not convenience, it is verification. A document is JSON, which means anything
 * can write one — a script, a backend, or an agent asked for "a template for the spring
 * newsletter". What such an author cannot do is see the result, and email HTML is a domain
 * where plausible-looking markup breaks in Outlook and nowhere else.
 *
 * So `check` is the important command: it validates the shape, renders it, and reports what
 * the editor's own inspector would report — over the size Gmail clips at, images without alt
 * text, content wider than the mail. That closes the loop for an author with no browser.
 *
 * No dependencies, and nothing here that the editor does not already do.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { version } = require_("../package.json");

const dist = (path) => import(new URL(`../dist/${path}`, import.meta.url).href);

const USAGE = `mail-designer ${version}

  mail-designer render <doc.json> [options]   Render to email HTML
  mail-designer text <doc.json> [options]     Render the plain-text alternative
  mail-designer check <doc.json> [options]    Validate, render, and report problems
  mail-designer fields <doc.json>             List the data fields the document uses
  mail-designer new [preset] [options]        Write a starting document
  mail-designer presets                       List the built-in starting points
  mail-designer mcp                           Run as an MCP server on stdio

Options
  --data <file.json>   Substitute these values for [Bracketed] tokens
  --out <file>         Write to a file instead of stdout
  --pretty             render: indent the HTML for reading (adds whitespace)
  --json               Machine-readable output (check, fields)
  --strict             check: warnings fail as well as errors

Exit codes
  0  fine    1  invalid document, or --strict with warnings    2  bad usage
`;

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parse(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (["json", "strict", "pretty", "help", "version"].includes(name)) {
      args.flags[name] = true;
    } else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`--${name} needs a value`);
      args.flags[name] = value;
      i += 1;
    }
  }
  return args;
}

function readJson(file, label) {
  let raw;
  try {
    raw = readFileSync(resolve(file), "utf8");
  } catch (error) {
    fail(`Could not read ${label} ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`, 1);
  }
}

/** Every command that takes a document validates it first. Nothing renders unvalidated. */
async function loadDocument(file) {
  if (!file) fail("Which document? Pass a path to a .json file.");
  const parsed = readJson(file, "document");
  const { validateDocument } = await dist("validate.js");
  const result = validateDocument(parsed);
  return { document: parsed, ...result };
}

function output(text, out) {
  if (out) {
    writeFileSync(resolve(out), text, "utf8");
    process.stderr.write(`Wrote ${out} (${Buffer.byteLength(text)} bytes)\n`);
  } else {
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  }
}

function reportInvalid(issues, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: false, issues }, null, 2)}\n`);
  } else {
    process.stderr.write("Invalid document:\n");
    for (const issue of issues) {
      process.stderr.write(`  ${issue.path || "(root)"}: ${issue.message}\n`);
    }
  }
  process.exit(1);
}

async function render(args, format) {
  const { document, ok, issues } = await loadDocument(args._[1]);
  if (!ok) reportInvalid(issues, false);

  const { toHtml } = await dist("render/toHtml.js");
  const data = args.flags.data ? readJson(args.flags.data, "data") : undefined;
  const result = toHtml(document, data ? { data } : {});
  if (format === "text") {
    output(result.text, args.flags.out);
    return;
  }
  // Compact by default: every byte counts against Gmail's clipping limit, and this output is
  // usually piped somewhere rather than read.
  const { formatHtml } = await dist("render/format.js");
  output(args.flags.pretty ? formatHtml(result.html) : result.html, args.flags.out);
}

async function check(args) {
  const asJson = Boolean(args.flags.json);
  const { document, ok, issues } = await loadDocument(args._[1]);
  if (!ok) reportInvalid(issues, asJson);

  const { toHtml } = await dist("render/toHtml.js");
  const { inspectEmail, emailSize } = await dist("render/inspect.js");
  const data = args.flags.data ? readJson(args.flags.data, "data") : undefined;
  const result = toHtml(document, data ? { data } : {});
  const warnings = inspectEmail(document, result);
  const bytes = emailSize(result.html);
  const errors = warnings.filter((w) => w.level === "error");
  const strict = Boolean(args.flags.strict);

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, bytes, warnings }, null, 2)}\n`);
  } else {
    process.stdout.write(`Document is valid. ${(bytes / 1024).toFixed(1)} kB of HTML.\n`);
    for (const warning of warnings) {
      process.stdout.write(`  ${warning.level === "error" ? "error" : "warning"}: ${warning.id}\n`);
    }
    if (warnings.length === 0) process.stdout.write("  no warnings\n");
  }

  if (errors.length > 0 || (strict && warnings.length > 0)) process.exit(1);
}

async function fields(args) {
  const { document, ok, issues } = await loadDocument(args._[1]);
  if (!ok) reportInvalid(issues, Boolean(args.flags.json));
  const { extractDataFields } = await dist("render/dataFields.js");
  const found = extractDataFields(document);
  process.stdout.write(
    args.flags.json ? `${JSON.stringify(found, null, 2)}\n` : `${found.join("\n")}\n`,
  );
}

async function newDocument(args) {
  const { builtInPresets, findPreset } = await dist("presets/index.js");
  const wanted = args._[1] ?? "blank";
  // findPreset, so the CLI takes the display name too — `new confirmation` for `receipt`.
  const preset = findPreset(wanted, builtInPresets);
  if (!preset) {
    fail(`No preset "${wanted}". Try: ${builtInPresets.map((p) => p.id).join(", ")}`);
  }
  output(`${JSON.stringify(preset.document, null, 2)}\n`, args.flags.out);
}

async function presets() {
  const { builtInPresets } = await dist("presets/index.js");
  for (const preset of builtInPresets) {
    process.stdout.write(`${preset.id.padEnd(14)} ${preset.name}\n`);
  }
}

const args = parse(process.argv.slice(2));
const command = args._[0];

if (args.flags.version) {
  process.stdout.write(`${version}\n`);
} else if (!command || args.flags.help || command === "help") {
  process.stdout.write(USAGE);
} else {
  switch (command) {
    case "render":
      await render(args, "html");
      break;
    case "text":
      await render(args, "text");
      break;
    case "check":
      await check(args);
      break;
    case "fields":
      await fields(args);
      break;
    case "new":
      await newDocument(args);
      break;
    case "presets":
      await presets();
      break;
    case "mcp": {
      const { serve } = await import(new URL("./mcp.mjs", import.meta.url).href);
      serve();
      break;
    }
    default:
      fail(`Unknown command "${command}".\n\n${USAGE}`);
  }
}
