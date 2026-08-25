import type { DropTarget } from "./findDropTarget.js";

/**
 * The insertion line. Fixed positioning because the rects come from
 * getBoundingClientRect and are therefore viewport coordinates — no offset parent to
 * reason about, and no drift when the canvas is scrolled.
 */
export function DropIndicator({ target }: { target: DropTarget | null }) {
  if (!target) return null;
  return (
    <div
      className="md-drop-indicator"
      style={{ top: target.indicator.top, left: target.indicator.left, width: target.indicator.width }}
      aria-hidden
    />
  );
}
