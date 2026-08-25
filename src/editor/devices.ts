import type { Viewport } from "./Toolbar.js";

/**
 * Real device geometry, in CSS pixels — which for these devices is the same as points.
 *
 * The numbers matter more than they look. A preview at "some narrow width" answers a question
 * nobody asked; a preview at 393px answers what the mail looks like on the phone most people
 * actually hold. Everything else here — status bar, nav bar, toolbar — is subtracted from the
 * screen, so `content` is what is genuinely left for the mail once the client has taken its
 * share. That is the number the fold depends on.
 */
export interface DeviceMetrics {
  /** Screen size, excluding the hardware bezel. */
  screen: { width: number; height: number };
  /** Width the mail is rendered at inside this client. */
  content: number;
  /** Bezel thickness around the screen. */
  bezel: number;
  /** Screen corner radius; the device's own is this plus the bezel. */
  radius: number;
}

export const DEVICES: Record<Viewport, DeviceMetrics> = {
  /**
   * A desktop mail client window rather than a whole monitor. The reading pane is what the
   * mail gets: window minus the folder list and the message list.
   */
  desktop: {
    screen: { width: 1180, height: 720 },
    content: 1180 - 212 - 296,
    bezel: 0,
    radius: 10,
  },

  /** iPad Air 11" portrait. */
  tablet: {
    screen: { width: 820, height: 1180 },
    content: 820,
    bezel: 22,
    radius: 18,
  },

  /** iPhone 16 / 15 portrait. */
  phone: {
    screen: { width: 393, height: 852 },
    content: 393,
    bezel: 13,
    radius: 47,
  },
};

/** Outer size of the framed device, bezel included — what has to fit in the pane. */
export function frameSize(viewport: Viewport): { width: number; height: number } {
  const { screen, bezel } = DEVICES[viewport];
  return { width: screen.width + bezel * 2, height: screen.height + bezel * 2 };
}

/**
 * How much the frame has to shrink to fit the space available, never scaling up past 1:1.
 *
 * Scaling the whole frame is what keeps the geometry honest: the mail inside still renders at
 * the device's true content width, so its media queries fire exactly as they would on the
 * device. Rendering a phone at 300px instead would silently change which breakpoints apply.
 */
export function fitScale(
  viewport: Viewport,
  available: { width: number; height: number },
): number {
  const size = frameSize(viewport);
  if (available.width <= 0 || available.height <= 0) return 1;
  return Math.min(1, available.width / size.width, available.height / size.height);
}
