/**
 * Runs the test files, portably.
 *
 * Why this exists rather than a glob in the npm script: there is no single `node --test`
 * invocation that works across the Node versions this package supports. Node 20 accepts a
 * directory and does not understand glob patterns; Node 22 and later understand globs and
 * refuse a directory, trying to load it as a module. And an unquoted shell glob is not an
 * escape either — npm runs scripts through cmd.exe on Windows, which does not expand it.
 *
 * The failure mode is what makes it worth a file: `node --test 'test/*.test.mjs'` passes on a
 * modern local Node and fails only on the Node 20 leg of CI, so it looks like a CI problem
 * rather than a broken command.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const files = readdirSync("test")
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => join("test", f));

if (files.length === 0) {
  process.stderr.write("run-tests: no test files found in test/\n");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
