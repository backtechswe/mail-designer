import type { SpacerBlock } from "../types.js";

export function SpacerView({ block, active }: { block: SpacerBlock; active: boolean }) {
  // Invisible in a real email, so the canvas shows the reserved space explicitly —
  // otherwise the block is impossible to find and click.
  return (
    <div className="md-spacer" style={{ height: block.height }} aria-hidden>
      {active ? <span>{block.height}px</span> : null}
    </div>
  );
}
