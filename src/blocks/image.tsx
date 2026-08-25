import type { ImageBlock } from "../types.js";
import { useEditor } from "../editor/EditorContext.js";
import { Icon } from "../editor/icons.js";
import { safeImageUrl } from "../render/esc.js";

export function ImageView({ block }: { block: ImageBlock }) {
  const { t } = useEditor();
  const src = safeImageUrl(block.src);

  if (!src) {
    // A placeholder rather than nothing: an image block with no source still needs to be
    // selectable, or the user cannot reach the inspector to give it one.
    return (
      <div className="md-image-placeholder">
        <Icon name="image" size={20} />
        <span>{t("canvas.imagePlaceholder")}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={block.alt}
      style={{
        display: "block",
        width: "100%",
        maxWidth: block.width ? `${block.width}px` : "100%",
        height: "auto",
        border: 0,
        borderRadius: block.borderRadius ? `${block.borderRadius}px` : undefined,
        margin: block.align === "center" ? "0 auto" : block.align === "right" ? "0 0 0 auto" : "0",
      }}
    />
  );
}
