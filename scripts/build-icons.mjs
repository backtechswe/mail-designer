/**
 * Generates src/editor/icons.tsx from a local Font Awesome download.
 *
 *   node scripts/build-icons.mjs [--fa /path/to/fontawesome-web]
 *
 * Licensing is the reason this is a script and not a copy-paste job. Font Awesome **Pro**
 * may be used in your own applications but not redistributed — and an npm package is
 * redistribution the moment it is published or shared. Font Awesome's own metadata records
 * which icons are free (CC BY 4.0), so the generator reads that and **fails** on a Pro-only
 * icon rather than quietly baking one in. The cost of staying on the free set is zero; the
 * cost of finding out later is not.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Every icon the editor uses. Keep the keys semantic (what it means here) rather than
 * cosmetic (what it looks like) — swapping the glyph later should not touch call sites.
 */
const ICONS = {
  // block types, in palette order
  // A section is a band that holds other blocks, so the icon says "a group of things"
  // rather than "a rectangle".
  section: ["object-group", "regular"],
  heading: ["heading", "solid"],
  text: ["align-left", "solid"],
  image: ["image", "regular"],
  button: ["hand-pointer", "solid"],
  columns: ["table-columns", "solid"],
  social: ["share-nodes", "solid"],
  divider: ["minus", "solid"],
  spacer: ["arrows-up-down", "solid"],
  code: ["code", "solid"],

  // structure and manipulation
  grip: ["grip-vertical", "solid"],
  plus: ["plus", "solid"],
  trash: ["trash", "solid"],
  copy: ["clone", "regular"],
  up: ["chevron-up", "solid"],
  down: ["chevron-down", "solid"],
  left: ["chevron-left", "solid"],
  right: ["chevron-right", "solid"],
  // The u-turn arrows read as "step back / step forward" far better than a circular arrow,
  // which says "reload". arrow-u-turn-up-left and -right are the exact shapes, but Font
  // Awesome marks both Pro-only, so the generator refuses them and these are the free pair
  // with the same gesture.
  undo: ["reply", "solid"],
  redo: ["share", "solid"],
  close: ["xmark", "solid"],
  check: ["check", "solid"],

  // views and settings
  desktop: ["desktop", "solid"],
  mobile: ["mobile-screen", "solid"],
  tablet: ["tablet-screen-button", "solid"],
  laptop: ["laptop", "solid"],
  frame: ["crop-simple", "solid"],
  eye: ["eye", "solid"],
  edit: ["pencil", "solid"],
  gear: ["gear", "solid"],
  templates: ["layer-group", "solid"],
  upload: ["upload", "solid"],
  save: ["floppy-disk", "regular"],

  // text toolbar
  bold: ["bold", "solid"],
  italic: ["italic", "solid"],
  underline: ["underline", "solid"],
  link: ["link", "solid"],
  unlink: ["link-slash", "solid"],
  palette: ["palette", "solid"],
  tag: ["tag", "solid"],
  alignLeft: ["align-left", "solid"],
  alignCenter: ["align-center", "solid"],
  alignRight: ["align-right", "solid"],
  lock: ["lock", "solid"],
  unlock: ["lock-open", "solid"],

  // The mail-client mock around the preview. Chrome, not editor controls: these only ever
  // appear inside the device frame.
  inbox: ["inbox", "solid"],
  sent: ["paper-plane", "solid"],
  drafts: ["file-lines", "regular"],
  archive: ["box-archive", "solid"],
  flag: ["flag", "solid"],
  star: ["star", "regular"],
  reply: ["reply", "solid"],
  replyAll: ["reply-all", "solid"],
  forward: ["share", "solid"],
  folder: ["folder", "regular"],
  search: ["magnifying-glass", "solid"],
  wifi: ["wifi", "solid"],
  battery: ["battery-full", "solid"],
  signal: ["signal", "solid"],
  ellipsis: ["ellipsis", "solid"],
  compose: ["pen-to-square", "solid"],
  sidebar: ["bars", "solid"],
};

function resolveFontAwesomeDir() {
  const flagIndex = process.argv.indexOf("--fa");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1];
  if (process.env.FONTAWESOME_DIR) return process.env.FONTAWESOME_DIR;

  const candidates = [
    join(homedir(), "Downloads", "fontawesome-pro-7.1.0-web"),
    join(homedir(), "Downloads", "fontawesome-free-7.1.0-web"),
  ];
  const found = candidates.find((dir) => existsSync(join(dir, "metadata", "icons.json")));
  if (found) return found;

  throw new Error(
    "Could not find a Font Awesome download. Pass --fa <dir> or set FONTAWESOME_DIR.\n" +
      `Looked in:\n  ${candidates.join("\n  ")}`,
  );
}

const faDir = resolveFontAwesomeDir();
const metadata = JSON.parse(readFileSync(join(faDir, "metadata", "icons.json"), "utf8"));

const entries = [];
const problems = [];

for (const [key, [name, style]] of Object.entries(ICONS)) {
  const meta = metadata[name];
  if (!meta) {
    problems.push(`${key}: no icon named "${name}" in this Font Awesome release.`);
    continue;
  }
  const free = meta.free ?? [];
  if (!free.includes(style)) {
    problems.push(
      `${key}: "${name}" is not free in the "${style}" style ` +
        `(free: ${free.length ? free.join(", ") : "none"}). ` +
        `Pick a free alternative — a Pro-only icon cannot be redistributed in this package.`,
    );
    continue;
  }

  const file = join(faDir, "svgs", style, `${name}.svg`);
  if (!existsSync(file)) {
    problems.push(`${key}: expected ${file} to exist.`);
    continue;
  }

  const svg = readFileSync(file, "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  // Solid and regular glyphs are a single path; anything else would need a different
  // component shape, so surface it instead of silently dropping geometry.
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!viewBox || paths.length === 0) {
    problems.push(`${key}: could not read a viewBox and path from ${file}.`);
    continue;
  }
  if (paths.length > 1) {
    problems.push(`${key}: "${name}" has ${paths.length} paths; only single-path icons are supported.`);
    continue;
  }

  entries.push({ key, name, style, viewBox, path: paths[0] });
}

if (problems.length > 0) {
  console.error(`\nRefusing to generate icons.tsx — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error("");
  process.exit(1);
}

const body = entries
  .map((e) => `  ${e.key}: ["${e.viewBox}", "${e.path}"], // fa-${e.name} (${e.style})`)
  .join("\n");

const output = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/build-icons.mjs
 *
 * Icons by Font Awesome (https://fontawesome.com), CC BY 4.0.
 * Only icons Font Awesome marks as free are vendored here; the generator refuses
 * Pro-only glyphs, which may not be redistributed.
 */
import { useCustomisation } from "./customise.js";

export const iconPaths = {
${body}
} as const;

export type IconName = keyof typeof iconPaths;

export interface IconProps {
  name: IconName;
  /** Rendered square size in px. Default 16. */
  size?: number;
  /**
   * Accessible label. Omit for a decorative icon sitting next to real text — the icon is
   * then hidden from assistive tech instead of being read out twice.
   */
  title?: string;
  className?: string;
}

/**
 * fill="currentColor" is the whole trick: icons inherit their colour from the surrounding
 * text, so a theme change needs no icon change.
 */
export function Icon({ name, size = 16, title, className }: IconProps) {
  // A host's own glyph wins, so an application with an icon set does not end up with two.
  const Replacement = useCustomisation().icons?.[name];
  if (Replacement) return <Replacement size={size} className={className} />;

  const [viewBox, path] = iconPaths[name];
  return (
    <svg
      className={className}
      viewBox={viewBox}
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{ display: "block", flex: "none" }}
    >
      {title ? <title>{title}</title> : null}
      <path d={path} />
    </svg>
  );
}
`;

const target = join(here, "..", "src", "editor", "icons.tsx");
writeFileSync(target, output);
console.log(`Generated ${entries.length} icons from ${faDir}`);
console.log(`  -> ${target}`);
