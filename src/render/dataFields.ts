import type { MailDocument } from "../types.js";
import { walkBlocks } from "../document.js";
import { escAttr } from "./esc.js";

/**
 * Merge fields are [Bracketed] tokens. They survive rendering untouched and are
 * substituted afterwards, per recipient — which means one render can serve a whole
 * mailing list, and the host app decides where the values come from.
 */
export const DATA_TOKEN = /\[([^[\]\n]{1,64})\]/g;

export interface DataOptions {
  /**
   * "html" escapes the substituted value. Always use it when the target is markup —
   * a recipient named `Ben & Jerry's` must not be able to break the document.
   */
  escape?: "html" | "none";
  /** "keep" leaves an unmatched token visible (default); "blank" removes it. */
  onMissing?: "keep" | "blank";
}

export function applyDataValues(
  input: string,
  values: Record<string, string> | undefined,
  options: DataOptions = {},
): string {
  if (!input) return input;
  const { escape = "html", onMissing = "keep" } = options;
  if (!values) return onMissing === "blank" ? input.replace(DATA_TOKEN, "") : input;

  return input.replace(DATA_TOKEN, (whole, name: string) => {
    const key = name.trim();
    const value = values[key] ?? findCaseInsensitive(values, key);
    if (value === undefined) return onMissing === "blank" ? "" : whole;
    return escape === "html" ? escAttr(value) : value;
  });
}

function findCaseInsensitive(
  values: Record<string, string>,
  key: string,
): string | undefined {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(values)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/**
 * Every token used anywhere in the document, in the order they appear. The host app
 * uses this to tell the user which columns the design actually needs — including the
 * ones hidden in a button's URL, which is exactly the case people forget.
 */
export function extractDataFields(doc: MailDocument): string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  const scan = (value: string | undefined): void => {
    if (!value) return;
    for (const match of value.matchAll(DATA_TOKEN)) {
      const name = (match[1] ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      order.push(name);
    }
  };

  scan(doc.settings.preheader);
  walkBlocks(doc, (block) => {
    switch (block.type) {
      case "heading":
      case "text":
      case "html":
        scan(block.html);
        break;
      case "image":
        scan(block.alt);
        scan(block.src);
        scan(block.href);
        break;
      case "button":
        scan(block.label);
        scan(block.href);
        break;
      case "social":
        for (const item of block.items) {
          scan(item.href);
          scan(item.label);
        }
        break;
      default:
        break;
    }
  });

  return order;
}
