import type { LeafBlock, MailDocument, SectionChild } from "../types.js";
import { safeUrl } from "./esc.js";
import { stripTags } from "./sanitize.js";

/**
 * The text/plain alternative. Worth generating properly rather than dumping tags: spam
 * filters score a missing or empty text part against you, and some clients still prefer it.
 */
export function toPlainText(doc: MailDocument): string {
  const parts: string[] = [];
  if (doc.settings.preheader) parts.push(stripTags(doc.settings.preheader));

  for (const section of doc.blocks) {
    const chunk = renderChildren(section.children);
    if (chunk) parts.push(chunk);
  }

  return parts
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderChildren(children: readonly SectionChild[]): string {
  return children
    .map((child) =>
      child.type === "columns"
        ? child.columns.map((column) => renderChildren(column.children)).filter(Boolean).join("\n\n")
        : renderLeaf(child),
    )
    .filter(Boolean)
    .join("\n\n");
}

function renderLeaf(block: LeafBlock): string {
  switch (block.type) {
    case "heading":
      return stripTags(block.html);
    case "text":
    case "html":
      return stripTags(block.html);
    case "image": {
      // Only worth a line if it says something a reader would otherwise miss.
      const alt = (block.alt ?? "").trim();
      const href = block.href ? safeUrl(block.href) : "";
      if (!alt && !href) return "";
      if (alt && href) return `[${alt}] ${href}`;
      return alt ? `[${alt}]` : href;
    }
    case "button": {
      const label = (block.label ?? "").trim();
      const href = safeUrl(block.href);
      if (!href) return label;
      return label ? `${label}: ${href}` : href;
    }
    case "social":
      return block.items
        .map((item) => {
          const href = safeUrl(item.href);
          const label = item.label ?? item.network;
          return href ? `${label}: ${href}` : "";
        })
        .filter(Boolean)
        .join("\n");
    case "divider":
      return "—".repeat(24);
    case "spacer":
      return "";
  }
}
