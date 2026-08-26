/**
 * Adds the "use client" directive to the built files that need it.
 *
 * Why a script rather than a source-level directive: `tsc` strips directives it does not
 * recognise, so writing `"use client"` at the top of src/index.ts produces a dist file without
 * it. And without it, importing MailDesigner from a Next.js App Router page throws
 * *"You're importing a component that needs useState"* — the editor is a client component by
 * nature, and nothing in the compiler knows that.
 *
 * A bundler (tsup has a `banner` option) is the usual answer. Fifteen lines and no dependency
 * is the cheaper one, and it keeps the build as `tsc` plus two file operations.
 *
 * Only modules that actually reach for React state get it. `dist/render/**` deliberately does
 * not: it is the entry a server imports, and marking it client-only would be a lie that
 * breaks the very use it exists for.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIRECTIVE = '"use client";\n';
const CLIENT_DIRS = ["dist", "dist/editor", "dist/editor/fields", "dist/editor/dnd", "dist/blocks", "dist/data", "dist/session"];

/** Files under dist/render are server-safe and must stay that way. */
const isRenderEntry = (path) => path.includes("dist/render/") || path.includes("dist\\render\\");

let touched = 0;

for (const dir of CLIENT_DIRS) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    continue;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (!entry.endsWith(".js") || statSync(path).isDirectory() || isRenderEntry(path)) continue;
    const source = readFileSync(path, "utf8");
    // Only where it is true: a module using hooks or the DOM cannot render on the server.
    const needsClient = /\buse(State|Effect|Ref|Memo|Callback|Id|LayoutEffect|Context)\b|createContext|document\.|window\./.test(source);
    if (!needsClient || source.startsWith('"use client"')) continue;
    writeFileSync(path, DIRECTIVE + source);
    touched += 1;
  }
}

process.stdout.write(`post-build: "use client" added to ${touched} files\n`);
