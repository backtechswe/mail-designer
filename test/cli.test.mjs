/**
 * The CLI, end to end.
 *
 * Exit codes are the interface here: a script or an agent decides what to do next from them,
 * so they are worth testing as carefully as the output.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/mail-designer.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "md-cli-"));

/** Runs the CLI and returns { code, stdout, stderr } without throwing on a non-zero exit. */
function run(...args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

function fixture(name, value) {
  const path = join(dir, name);
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
  return path;
}

test("with no arguments it explains itself rather than doing something", () => {
  const { code, stdout } = run();
  assert.equal(code, 0);
  assert.match(stdout, /mail-designer render/);
});

test("new writes a valid document, and check agrees", () => {
  const path = join(dir, "doc.json");
  assert.equal(run("new", "newsletter", "--out", path).code, 0);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(doc.version, 1);
  assert.ok(doc.blocks.length > 0);

  const checked = run("check", path);
  assert.equal(checked.code, 0);
  assert.match(checked.stdout, /valid/);
});

test("an unknown preset lists the real ones instead of guessing", () => {
  const { code, stderr } = run("new", "nyhetsbrev");
  assert.equal(code, 2);
  assert.match(stderr, /newsletter/);
});

test("render produces email HTML on stdout", () => {
  const path = join(dir, "doc.json");
  const { code, stdout } = run("render", path);
  assert.equal(code, 0);
  assert.match(stdout, /^<!DOCTYPE html PUBLIC/);
  assert.match(stdout, /role="presentation"/);
});

test("render substitutes data when given some", () => {
  const doc = fixture("hello.json", {
    version: 1,
    settings: {},
    blocks: [
      {
        id: "s",
        type: "section",
        children: [{ id: "t", type: "text", html: "<p>Hi [Name]</p>", align: "left" }],
      },
    ],
  });
  const data = fixture("data.json", { Name: "Anna" });
  const plain = run("render", doc).stdout;
  const filled = run("render", doc, "--data", data).stdout;
  assert.match(plain, /\[Name\]/);
  assert.match(filled, /Hi Anna/);
  assert.ok(!filled.includes("[Name]"));
});

test("text renders the plain-text alternative, not markup", () => {
  const { code, stdout } = run("text", join(dir, "hello.json"));
  assert.equal(code, 0);
  assert.ok(!stdout.includes("<table"));
  assert.match(stdout, /Hi \[Name\]/);
});

test("an invalid document fails with readable issues and exit 1", () => {
  const path = fixture("broken.json", { version: 2, blocks: "nope" });
  const { code, stderr } = run("check", path);
  assert.equal(code, 1);
  assert.match(stderr, /Unsupported document version/);
  assert.match(stderr, /Missing blocks array/);
});

test("malformed JSON fails as a document problem, not a crash", () => {
  const path = fixture("junk.json", "{ nope");
  const { code, stderr } = run("check", path);
  assert.equal(code, 1);
  assert.match(stderr, /not valid JSON/);
});

test("a missing file is a usage error, not a stack trace", () => {
  const { code, stderr } = run("check", join(dir, "absent.json"));
  assert.equal(code, 2);
  assert.match(stderr, /Could not read/);
  assert.ok(!stderr.includes("at Object"), "no stack trace");
});

test("--json gives a machine-readable report", () => {
  const path = fixture("noalt.json", {
    version: 1,
    settings: {},
    blocks: [
      {
        id: "s",
        type: "section",
        children: [{ id: "i", type: "image", src: "https://x/y.png", alt: "", align: "center" }],
      },
    ],
  });
  const { code, stdout } = run("check", path, "--json");
  assert.equal(code, 0, "warnings alone do not fail");
  const report = JSON.parse(stdout);
  assert.equal(report.ok, true);
  assert.ok(report.bytes > 0);
  assert.ok(report.warnings.some((w) => w.id === "missing-alt"));
});

test("--strict turns warnings into a failure", () => {
  const { code } = run("check", join(dir, "noalt.json"), "--strict");
  assert.equal(code, 1);
});

test("fields lists the tokens the document uses, including in URLs", () => {
  const path = fixture("fields.json", {
    version: 1,
    settings: { preheader: "Hi [Name]" },
    blocks: [
      {
        id: "s",
        type: "section",
        children: [
          {
            id: "b",
            type: "button",
            label: "Book [Time]",
            href: "https://x/?id=[Id]",
            backgroundColor: "#000",
            textColor: "#fff",
            borderRadius: 4,
            fontSize: 16,
            align: "left",
            width: 200,
          },
        ],
      },
    ],
  });
  const { code, stdout } = run("fields", path, "--json");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout).sort(), ["Id", "Name", "Time"]);
});

test("an unknown command says so and shows the usage", () => {
  const { code, stderr } = run("frobnicate", "x");
  assert.equal(code, 2);
  assert.match(stderr, /Unknown command/);
});

test("a flag without its value is refused rather than guessed at", () => {
  const { code, stderr } = run("render", join(dir, "doc.json"), "--data");
  assert.equal(code, 2);
  assert.match(stderr, /--data needs a value/);
});

test("check on a conditional document without data says so, and does not pass", () => {
  // Rendering it without data drops every conditional block, so what was measured is not the
  // mail anyone receives. Exit 1 with the id is the actionable form of that: run it again
  // with --data.
  const path = join(dir, "conditional.json");
  assert.equal(run("new", "newsletter", "--out", path).code, 0);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const section = doc.blocks[0];
  section.children = [
    ...section.children,
    { id: "cond", type: "text", html: "Note: [Note]", align: "left", hideWhenEmpty: true },
  ];
  writeFileSync(path, JSON.stringify(doc));

  const bare = run("check", path);
  assert.equal(bare.code, 1);
  assert.match(bare.stdout, /error: conditional-without-data/);

  const withData = run("check", path, "--data", fixture("data.json", { Note: "careful" }));
  assert.doesNotMatch(withData.stdout, /conditional-without-data/);
});
