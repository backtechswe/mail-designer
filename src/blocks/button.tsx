import type { ButtonBlock } from "../types.js";
import { useEditor } from "../editor/EditorContext.js";
import { spacingToCss } from "./canvasStyle.js";

export function ButtonView({ block }: { block: ButtonBlock }) {
  const { doc } = useEditor();
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
          display: "inline-block",
          boxSizing: "border-box",
          fontFamily: block.fontFamily ?? doc.settings.fontFamily,
          fontSize: block.fontSize,
          lineHeight: 1.2,
          fontWeight: "bold",
          color: block.textColor,
          background: block.backgroundColor,
          padding: spacingToCss(block.innerPadding),
          borderRadius: block.borderRadius,
          width: block.fullWidth ? "100%" : block.width ? `${block.width}px` : undefined,
          textAlign: "center",
        }}
      >
        {block.label}
      </span>
    </div>
  );
}
