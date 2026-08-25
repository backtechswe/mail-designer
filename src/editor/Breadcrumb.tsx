import { ancestorsOf } from "../document.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";

/**
 * The chain of blocks around the selected one, each of them clickable.
 *
 * Not decoration — it is the only reliable way to reach a block that another block covers
 * completely. A section whose single child is an edge-to-edge image has no pixel belonging to
 * the section rather than the image, so no amount of careful aiming gets you there. Selecting
 * the image and stepping out does.
 *
 * It also answers a question the canvas cannot: what is this block actually inside?
 */
export function Breadcrumb() {
  const { doc, selectedId, select, t } = useEditor();
  if (!selectedId) return null;

  const chain = ancestorsOf(doc, selectedId);
  if (chain.length < 2) return null;

  return (
    <nav className="md-breadcrumb" aria-label={t("inspector.selection")}>
      {chain.map((block, index) => {
        const last = index === chain.length - 1;
        return (
          <span key={block.id}>
            {index > 0 ? <Icon name="right" size={8} /> : null}
            <button
              type="button"
              disabled={last}
              aria-current={last ? "true" : undefined}
              title={last ? undefined : t("inspector.selectParent")}
              onClick={() => select(block.id)}
            >
              {t(`block.${block.type}` as "block.text")}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
