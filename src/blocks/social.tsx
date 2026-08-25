import type { SocialBlock } from "../types.js";
import { Icon } from "../editor/icons.js";
import { useEditor } from "../editor/EditorContext.js";
import { safeImageUrl } from "../render/esc.js";

export function SocialView({ block }: { block: SocialBlock }) {
  const { t } = useEditor();
  if (block.items.length === 0) {
    return (
      <div className="md-image-placeholder">
        <Icon name="social" size={18} />
        <span>{t("block.social")}</span>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: block.spacing,
        justifyContent:
          block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      {block.items.map((item, index) => {
        const src = safeImageUrl(item.iconUrl);
        return src ? (
          <img
            key={`${item.network}-${index}`}
            src={src}
            alt={item.label ?? item.network}
            width={block.iconSize}
            height={block.iconSize}
            style={{ display: "block", width: block.iconSize, height: block.iconSize }}
          />
        ) : (
          <span key={`${item.network}-${index}`} className="md-social-missing">
            {item.network}
          </span>
        );
      })}
    </div>
  );
}
