import { useMemo } from "react";
import type { MailDocument } from "../types.js";
import { toHtml } from "../render/toHtml.js";

/**
 * The byte-exact truth: the actual renderer output in an iframe.
 *
 * The canvas only approximates the email, so this is where a design gets checked. Note the
 * iframe is *not* sandboxed away from rendering — it needs to lay out real tables — but it
 * is given no allow-scripts, so a raw-HTML block cannot execute anything here.
 */
export function PreviewFrame({ doc, width }: { doc: MailDocument; width: number }) {
  const html = useMemo(() => toHtml(doc).html, [doc]);
  return (
    <div className="md-preview">
      <iframe
        title="preview"
        // srcDoc rather than a blob URL: this re-renders on every edit, and blob URLs
        // would leak one object per keystroke.
        srcDoc={html}
        sandbox=""
        style={{ width }}
      />
    </div>
  );
}
