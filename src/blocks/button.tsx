import type { ButtonBlock } from "../types.js";
import { useEditor } from "../editor/EditorContext.js";
import { TextEditable } from "../editor/TextEditable.js";
import { spacingToCss } from "./canvasStyle.js";

/**
 * The label is edited on the button itself.
 *
 * It is the one piece of copy in a mail people most often want to change, and routing it
 * through the side panel meant selecting the block, finding the field, and writing a call to
 * action while looking somewhere other than the button it belongs to.
 *
 * `plain` keeps it a string: the model has nowhere to put markup and the renderer escapes the
 * value, so a stray `<b>` from a paste would be shown to the recipient as text.
 */
export function ButtonView({ block, active }: { block: ButtonBlock; active: boolean }) {
  const { doc, update, capabilities, t } = useEditor();
  const editable = capabilities(block).editContent;

  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <span
        className="md-buttonview"
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
        <TextEditable
          plain
          active={active && editable}
          editable={editable}
          html={block.label}
          placeholder={t("block.button")}
          // No typography of its own: the label inherits the button's, which is what puts the
          // caret exactly where the rendered text sits.
          style={{ minWidth: "1ch" }}
          onChange={(label) => update(block.id, { label })}
        />
      </span>
    </div>
  );
}
