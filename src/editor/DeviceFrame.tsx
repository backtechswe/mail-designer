import type { CSSProperties, ReactNode } from "react";
import type { Viewport } from "./Toolbar.js";

/**
 * A device outline around the preview.
 *
 * Drawn in CSS — no images, no dependency — and deliberately generic hardware rather than any
 * manufacturer's: it reads as a laptop, a tablet and a phone without pretending to be a
 * specific product.
 *
 * The point is not decoration. A 600px mail looks perfectly fine floating in a white void and
 * then arrives on a phone with the text running to both edges. Seeing it inside a screen the
 * size of a real one is what makes that obvious before it is sent.
 *
 * The screen therefore has a real device's height and the mail scrolls inside it. A frame that
 * simply grew to the height of the mail would be a 4000px-tall "phone", which answers the one
 * question the mockup exists to answer — how much of this is above the fold — wrongly.
 */
export function DeviceFrame({
  viewport,
  enabled,
  background,
  children,
}: {
  viewport: Viewport;
  enabled: boolean;
  /**
   * The mail's own page colour. The phone's status bar and home area are part of the screen,
   * so they have to continue that colour — a white strip across a dark mail would read as a
   * seam in the mail itself, which is exactly the kind of false alarm a preview must not give.
   */
  background?: string;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  const inset: CSSProperties | undefined = background ? { background } : undefined;

  if (viewport === "phone") {
    return (
      <div className="md-device md-device--phone">
        {/* The pill and the bar are what make a rounded rectangle read as a phone rather than
            a card. They sit inside the screen, over reserved strips, so the mail starts below
            the notch the way it does on a real device. */}
        <div className="md-device-screen">
          <div className="md-device-status" style={inset}>
            <span className="md-device-island" />
          </div>
          <div className="md-device-viewport">{children}</div>
          <div className="md-device-chin" style={inset}>
            <span className="md-device-home" />
          </div>
        </div>
      </div>
    );
  }

  if (viewport === "tablet") {
    return (
      <div className="md-device md-device--tablet">
        <span className="md-device-camera" />
        <div className="md-device-screen">
          <div className="md-device-viewport">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="md-device md-device--desktop">
      {/* A window bar rather than a whole laptop: the mail is being read in a mail client, and
          a title bar is the honest amount of chrome to imply. */}
      <div className="md-device-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="md-device-screen">
        <div className="md-device-viewport">{children}</div>
      </div>
      <div className="md-device-stand" />
    </div>
  );
}
