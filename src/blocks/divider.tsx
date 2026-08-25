import type { DividerBlock } from "../types.js";

export function DividerView({ block }: { block: DividerBlock }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          display: "block",
          width: `${block.width}%`,
          borderTop: `${block.thickness}px solid ${block.color}`,
          fontSize: 0,
          lineHeight: 0,
        }}
      />
    </div>
  );
}
