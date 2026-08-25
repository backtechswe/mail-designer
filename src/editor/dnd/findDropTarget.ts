import type { Container } from "../../document.js";

/**
 * Choosing where a drag lands.
 *
 * Split out as a pure function on purpose: this is the part of drag-and-drop that is
 * actually hard to get right, and the part that is impossible to verify by dragging things
 * around by hand. Given a point and a set of measured rectangles it is ordinary logic with
 * ordinary tests.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface MeasuredContainer {
  container: Container;
  rect: Rect;
  /** How many containers enclose this one. The deepest hit wins. */
  depth: number;
  /**
   * The container's real children, **including the block currently being dragged**.
   *
   * That inclusion is part of the contract, not an oversight. The index returned here is fed
   * to `moveBlock`, which expects an index into the document as it stands and compensates for
   * removing the block itself. Filtering the dragged block out here would compensate a second
   * time, and the two cancelled out in one direction only — dragging a block downwards moved
   * it nowhere while dragging up worked.
   */
  children: { id: string; rect: Rect }[];
}

export interface DropTarget {
  container: Container;
  index: number;
  /** Where to draw the insertion line, in the same coordinate space as the input rects. */
  indicator: { top: number; left: number; width: number };
}

const bottom = (rect: Rect): number => rect.top + rect.height;
const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= bottom(rect);

function distanceTo(rect: Rect, x: number, y: number): number {
  const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
  const dy = Math.max(rect.top - y, 0, y - bottom(rect));
  return Math.hypot(dx, dy);
}

export function findDropTarget(
  point: { x: number; y: number },
  containers: readonly MeasuredContainer[],
  /** Excludes containers that cannot hold the dragged block, and the block's own subtree. */
  accepts: (container: MeasuredContainer) => boolean,
): DropTarget | null {
  const eligible = containers.filter(accepts);
  if (eligible.length === 0) return null;

  // Containers nest, so a point inside a column is also inside its section and the
  // document. The innermost one is what the user means.
  const hits = eligible.filter((c) => contains(c.rect, point.x, point.y));
  const chosen =
    hits.length > 0
      ? hits.reduce((best, c) => (c.depth > best.depth ? c : best))
      : // Outside everything — fall back to the nearest, so a drag that strays a few pixels
        // past the edge still drops somewhere sensible instead of being cancelled.
        // Nested containers often share an edge and are therefore exactly equidistant; break
        // that tie by depth, matching the innermost-wins rule above.
        eligible.reduce((best, c) => {
          const d = distanceTo(c.rect, point.x, point.y);
          const bestD = distanceTo(best.rect, point.x, point.y);
          if (Math.abs(d - bestD) < 0.5) return c.depth > best.depth ? c : best;
          return d < bestD ? c : best;
        });

  if (chosen.children.length === 0) {
    return {
      container: chosen.container,
      index: 0,
      indicator: { top: chosen.rect.top, left: chosen.rect.left, width: chosen.rect.width },
    };
  }

  // Everything in this editor stacks vertically, so the boundary is the child's midpoint.
  for (const [index, child] of chosen.children.entries()) {
    const midpoint = child.rect.top + child.rect.height / 2;
    if (point.y < midpoint) {
      return {
        container: chosen.container,
        index,
        indicator: { top: child.rect.top, left: child.rect.left, width: child.rect.width },
      };
    }
  }

  const last = chosen.children[chosen.children.length - 1] as { id: string; rect: Rect };
  return {
    container: chosen.container,
    index: chosen.children.length,
    indicator: { top: bottom(last.rect), left: last.rect.left, width: last.rect.width },
  };
}
