import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MailDocument } from "../types.js";
import { toHtml } from "../render/toHtml.js";
import { WarningStrip } from "./WarningStrip.js";
import { DeviceFrame } from "./DeviceFrame.js";
import type { Viewport } from "./Toolbar.js";

/**
 * The byte-exact truth: the renderer's actual output in an iframe.
 *
 * On its own the frame grows to the height of the mail and the pane scrolls it, because
 * nested scrollbars make a long email hard to read through. Inside a device frame it is the
 * screen that scrolls instead — there, the height of the screen is the thing being shown.
 *
 * `sandbox="allow-same-origin"` is deliberate and is *not* the dangerous combination:
 * scripts are still blocked because `allow-scripts` is absent, so a raw-HTML block cannot
 * execute anything. Same-origin only buys the parent the ability to measure the content.
 */
export function PreviewFrame({
  doc,
  width,
  data,
  viewport = "desktop",
  mockup = false,
  identity,
}: {
  doc: MailDocument;
  width: number;
  /** Sample values substituted into the preview, so it shows a real recipient's mail. */
  data?: Record<string, string>;
  viewport?: Viewport;
  mockup?: boolean;
  /** Who the mock says the mail is from, and when. Editor chrome only — never rendered. */
  identity: { name: string; email: string; date: string };
}) {
  const rendered = useMemo(() => toHtml(doc, data ? { data } : {}), [doc, data]);
  const html = rendered.html;
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(600);

  const measure = useCallback(() => {
    const body = ref.current?.contentDocument?.body;
    if (!body) return;
    // scrollHeight on <body> rather than documentElement: the html element reports the
    // viewport height once the iframe has one, which would lock the frame at its old size.
    const next = Math.max(body.scrollHeight, 200);
    setHeight((current) => (Math.abs(current - next) > 1 ? next : current));
  }, []);

  useEffect(() => {
    // Remeasure after the document swaps, and again as images arrive — an email is mostly
    // images, and their height is unknown until they load.
    const frame = ref.current;
    if (!frame) return;
    measure();
    const timers = [40, 200, 600, 1500].map((ms) => window.setTimeout(measure, ms));
    const document_ = frame.contentDocument;
    const images = document_ ? Array.from(document_.images) : [];
    for (const img of images) img.addEventListener("load", measure);
    return () => {
      timers.forEach(window.clearTimeout);
      for (const img of images) img.removeEventListener("load", measure);
    };
  }, [html, width, measure]);

  return (
    <div className="md-preview">
      <WarningStrip doc={doc} result={rendered} />
      {/* The stage is what the device frame measures itself against. */}
      <div className={mockup ? "md-preview-stage md-preview-stage--framed" : "md-preview-stage"}>
        <DeviceFrame viewport={viewport} enabled={mockup} doc={doc} identity={identity}>
          <iframe
            ref={ref}
            title="preview"
            // srcDoc rather than a blob URL: this re-renders on every edit, and blob URLs
            // would leak one object per keystroke.
            srcDoc={html}
            sandbox="allow-same-origin"
            onLoad={measure}
            style={{ width, height }}
          />
        </DeviceFrame>
      </div>
    </div>
  );
}
