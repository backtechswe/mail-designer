import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { MailDocument } from "../types.js";
import type { Viewport } from "./Toolbar.js";
import { DEVICES, fitScale, frameSize } from "./devices.js";
import { MailClient } from "./MailClient.js";

/**
 * The preview inside a device running a mail client.
 *
 * Drawn in CSS — no images, no dependency, and no manufacturer's product — but at real
 * geometry: an iPhone 16's 393×852 points, an iPad Air 11"'s 820×1180, and a desktop window
 * whose reading pane is what is left after a folder list and a message list.
 *
 * The frame is *scaled* to fit rather than resized. That distinction is the whole point: the
 * mail inside still renders at the device's true content width, so its media queries fire
 * exactly as they would on the device. Rendering a phone at whatever width happened to fit
 * would quietly change which breakpoints apply, and the preview would be lying.
 */
export function DeviceFrame({
  viewport,
  enabled,
  doc,
  identity,
  children,
}: {
  viewport: Viewport;
  enabled: boolean;
  doc: MailDocument;
  identity: { name: string; email: string; date: string };
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Measured from the stage this sits in, not from the window: the host app owns everything
  // above us and we cannot know how tall its own chrome is.
  useLayoutEffect(() => {
    const host = hostRef.current;
    const stage = host?.parentElement;
    if (!enabled || !stage) return;

    const measure = (): void => {
      const next = fitScale(viewport, {
        // A couple of pixels of slack, so a rounding error cannot put a scrollbar on the
        // stage — which would shrink the stage, rescale, and remove the scrollbar again.
        width: stage.clientWidth - 4,
        height: stage.clientHeight - 4,
      });
      setScale((current) => (Math.abs(current - next) < 0.002 ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [enabled, viewport]);

  // Back to the top when the device changes: a scroll offset from a screen of a different
  // height points at nothing in particular.
  useEffect(() => {
    const scroller = hostRef.current?.querySelector<HTMLElement>(".md-device-viewport");
    if (scroller) scroller.scrollTop = 0;
  }, [viewport, enabled]);

  if (!enabled) return <>{children}</>;

  const size = frameSize(viewport);
  const { bezel, radius } = DEVICES[viewport];

  const outer: CSSProperties = {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
  const frame: CSSProperties = {
    width: size.width,
    height: size.height,
    padding: bezel,
    borderRadius: bezel > 0 ? radius + bezel : radius,
    transform: `scale(${scale})`,
  };

  return (
    <div className="md-device-fit" style={outer} ref={hostRef}>
      <div className={`md-device md-device--${viewport}`} style={frame}>
        <div className="md-device-screen" style={{ borderRadius: radius }}>
          <MailClient viewport={viewport} doc={doc} identity={identity}>
            {children}
          </MailClient>
        </div>
        {viewport === "phone" ? (
          <>
            {/* The pill and the bar are what make a rounded rectangle read as a phone. */}
            <span className="md-device-island" />
            <span className="md-device-home" />
          </>
        ) : null}
        {viewport === "tablet" ? <span className="md-device-camera" /> : null}
      </div>
    </div>
  );
}
