import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Block, BlockType } from "../../types.js";
import type { Container } from "../../document.js";
import { canInsert, createBlock } from "../../document.js";
import { findDropTarget } from "./findDropTarget.js";
import type { DropTarget, MeasuredContainer, Rect } from "./findDropTarget.js";

/**
 * Drag-and-drop on pointer events.
 *
 * Not HTML5 drag-and-drop: that API has poor touch support, almost no control over the drag
 * image, and a different event model per browser. Pointer events give one code path for
 * mouse, pen and finger.
 *
 * Two decisions are load-bearing:
 *
 *  - Window listeners are attached **imperatively in the pointerdown handler**, not from an
 *    effect keyed on state. A state-driven effect only attaches after React commits, and a
 *    fast drag — flick of the wrist, or a trackpad gesture — delivers its moves and its
 *    pointerup before that. The drag then silently does nothing.
 *  - Rectangles are measured once when the drag starts. Measuring forces layout, and doing
 *    it per pointermove is what makes hand-rolled sorting feel sticky. They are re-measured
 *    only when the canvas scrolls, which is the one thing that invalidates them.
 */

export type DragSource = { kind: "move"; id: string } | { kind: "create"; type: BlockType };

export interface DragState {
  source: DragSource;
  pointer: { x: number; y: number };
  target: DropTarget | null;
}

interface Options {
  canvasRef: RefObject<HTMLElement | null>;
  /** Resolves a block id to the block, so nesting rules can be checked while dragging. */
  getBlock: (id: string) => Block | undefined;
  onMove: (id: string, container: Container, index: number) => void;
  onCreate: (block: Block, container: Container, index: number) => void;
}

const DRAG_THRESHOLD = 4;
const AUTOSCROLL_ZONE = 56;
const AUTOSCROLL_SPEED = 12;

export function useDragSort({ canvasRef, getBlock, onMove, onCreate }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const containers = useRef<MeasuredContainer[]>([]);
  const pending = useRef<{ source: DragSource; x: number; y: number } | null>(null);
  const active = useRef<DragState | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const scrollFrame = useRef<number | null>(null);

  // Handlers are created at pointerdown and capture that render's props. A drag lasts a
  // second; there is no window in which a stale closure could matter.
  const latest = useRef({ getBlock, onMove, onCreate });
  latest.current = { getBlock, onMove, onCreate };

  const measure = useCallback(
    (source: DragSource) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // A block cannot be dropped inside itself; excluding its subtree here is cheaper than
      // filtering candidates on every move.
      const moving =
        source.kind === "move" ? canvas.querySelector(`[data-md-id="${source.id}"]`) : null;

      const toRect = (element: Element): Rect => {
        const box = element.getBoundingClientRect();
        return { top: box.top, left: box.left, width: box.width, height: box.height };
      };

      const measured: MeasuredContainer[] = [];
      for (const element of canvas.querySelectorAll<HTMLElement>("[data-md-container]")) {
        if (moving?.contains(element)) continue;

        const [kind, id] = (element.dataset.mdContainer ?? "").split(":");
        const container: Container | null =
          kind === "document"
            ? { kind: "document" }
            : kind === "section" && id
              ? { kind: "section", id }
              : kind === "column" && id
                ? { kind: "column", id }
                : null;
        if (!container) continue;

        let depth = 0;
        for (let node = element.parentElement; node; node = node.parentElement) {
          if (node.dataset.mdContainer) depth += 1;
        }

        const children: { id: string; rect: Rect }[] = [];
        for (const child of element.querySelectorAll<HTMLElement>("[data-md-id]")) {
          // Direct children of *this* container only, not blocks nested deeper.
          if (child.parentElement?.closest("[data-md-container]") !== element) continue;
          if (moving && (child === moving || moving.contains(child))) continue;
          const childId = child.dataset.mdId;
          if (childId) children.push({ id: childId, rect: toRect(child) });
        }

        measured.push({ container, rect: toRect(element), depth, children });
      }
      containers.current = measured;
    },
    [canvasRef],
  );

  const stopAutoscroll = useCallback(() => {
    if (scrollFrame.current !== null) {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    detach.current?.();
    detach.current = null;
    pending.current = null;
    active.current = null;
    stopAutoscroll();
    setDrag(null);
  }, [stopAutoscroll]);

  const arm = useCallback(
    (source: DragSource, event: React.PointerEvent) => {
      if (event.button !== 0) return;
      // Without this the browser starts a text selection under the drag: the CSS that
      // disables user-select only lands after React re-renders with the dragging class,
      // which is a frame too late. The caret is already sweeping across the canvas.
      event.preventDefault();
      // A second drag can only start after the first has torn down.
      detach.current?.();
      pending.current = { source, x: event.clientX, y: event.clientY };

      const accepts = (candidate: MeasuredContainer): boolean => {
        const block =
          source.kind === "create"
            ? ({ type: source.type } as Block)
            : latest.current.getBlock(source.id);
        // getBlock returns undefined for a block the user may not move, so a locked block
        // simply has nowhere to land.
        return block ? canInsert(block, candidate.container) : false;
      };

      const autoscroll = (y: number): void => {
        const canvas = canvasRef.current;
        stopAutoscroll();
        if (!canvas) return;
        const box = canvas.getBoundingClientRect();
        const delta =
          y < box.top + AUTOSCROLL_ZONE
            ? -AUTOSCROLL_SPEED
            : y > box.bottom - AUTOSCROLL_ZONE
              ? AUTOSCROLL_SPEED
              : 0;
        if (delta === 0) return;
        const step = (): void => {
          if (!active.current) return;
          const before = canvas.scrollTop;
          canvas.scrollTop += delta;
          // Already at the end: keep re-measuring and re-scrolling and the loop would run
          // a full layout pass every frame for nothing, for as long as the pointer rests
          // in the edge zone.
          if (canvas.scrollTop === before) {
            scrollFrame.current = null;
            return;
          }
          measure(active.current.source);
          scrollFrame.current = requestAnimationFrame(step);
        };
        scrollFrame.current = requestAnimationFrame(step);
      };

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const start = pending.current;
        if (start && !active.current) {
          // A short press must still be a click, so nothing drags until the pointer has
          // actually travelled.
          const travelled = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
          if (travelled < DRAG_THRESHOLD) return;
          measure(start.source);
          active.current = { source: start.source, pointer: { x: start.x, y: start.y }, target: null };
        }
        const current = active.current;
        if (!current) return;

        moveEvent.preventDefault();
        const point = { x: moveEvent.clientX, y: moveEvent.clientY };
        const next: DragState = {
          ...current,
          pointer: point,
          target: findDropTarget(point, containers.current, accepts),
        };
        active.current = next;
        setDrag(next);
        autoscroll(point.y);
      };

      const onPointerUp = (): void => {
        const current = active.current;
        const dragged = current !== null;
        teardown();
        if (dragged) {
          // pointerup is followed by a click, which would land on whatever is under the
          // pointer and re-select it — so a block dropped onto a section came back with
          // the *section* selected. Swallow exactly one click.
          window.addEventListener("click", swallow, { capture: true, once: true });
        }
        if (!current?.target) return;
        const { container, index } = current.target;
        if (current.source.kind === "move") {
          latest.current.onMove(current.source.id, container, index);
        } else {
          latest.current.onCreate(createBlock(current.source.type), container, index);
        }
      };

      const swallow = (clickEvent: MouseEvent): void => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
      };

      const onKeyDown = (keyEvent: KeyboardEvent): void => {
        if (keyEvent.key === "Escape") teardown();
      };

      const onScroll = (): void => {
        if (active.current) measure(active.current.source);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", teardown);
      window.addEventListener("keydown", onKeyDown);
      const canvas = canvasRef.current;
      canvas?.addEventListener("scroll", onScroll, { passive: true });

      detach.current = () => {
        window.removeEventListener("click", swallow, { capture: true });
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", teardown);
        window.removeEventListener("keydown", onKeyDown);
        canvas?.removeEventListener("scroll", onScroll);
      };
    },
    [canvasRef, measure, stopAutoscroll, teardown],
  );

  // A component that unmounts mid-drag must not leave window listeners behind.
  useEffect(() => () => detach.current?.(), []);

  return {
    /** Null until the pointer has moved past the threshold. */
    drag,
    startMove: useCallback(
      (id: string, event: React.PointerEvent) => arm({ kind: "move", id }, event),
      [arm],
    ),
    startCreate: useCallback(
      (type: BlockType, event: React.PointerEvent) => arm({ kind: "create", type }, event),
      [arm],
    ),
  };
}
