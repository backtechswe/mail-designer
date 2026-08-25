import type { MailDocument } from "../types.js";
import { walkBlocks } from "../document.js";

/** What an inbox shows about a message before it is opened. */
export interface MessageSummary {
  /** The subject line. Mail clients get this from the envelope; here, from the mail's own top heading. */
  subject: string;
  /** The line under the subject in a message list. */
  snippet: string;
  /** True when the snippet is body text because no preheader was set. */
  snippetIsFallback: boolean;
}

const TAGS = /<[^>]*>/g;
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&zwnj;": "",
};

/** Visible text of a block's HTML, for display in the mock — never for rendering. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(TAGS, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Subject and list snippet for the client mock.
 *
 * The snippet is the reason this exists rather than being two props. A mail client with no
 * preheader falls back to the opening words of the body, and the result is very often
 * "View this email in your browser" — which is a thing you cannot see in an editor that
 * previews the mail alone. Showing the fallback, and marking it as one, is the point.
 */
export function messageSummary(doc: MailDocument): MessageSummary {
  let subject = "";
  let firstText = "";

  walkBlocks(doc, (block) => {
    if (block.type === "heading" && !subject) subject = plain(block.html);
    if ((block.type === "text" || block.type === "heading") && !firstText) {
      firstText = plain(block.html);
    }
  });

  const preheader = (doc.settings.preheader ?? "").trim();
  return {
    subject,
    snippet: preheader || firstText,
    snippetIsFallback: !preheader && firstText !== "",
  };
}
