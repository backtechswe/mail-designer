import type { TextBlock } from "../types.js";
import { useEditor } from "../editor/EditorContext.js";
import { TextEditable } from "../editor/TextEditable.js";
import { textStyle } from "./canvasStyle.js";

export function TextView({ block, active }: { block: TextBlock; active: boolean }) {
  const { doc, update, capabilities, t } = useEditor();
  return (
    <TextEditable
      active={active && capabilities(block).editContent}
      editable={capabilities(block).editContent}
      html={block.html}
      placeholder={t("block.text")}
      style={textStyle(block, doc.settings)}
      onChange={(html) => update(block.id, { html })}
    />
  );
}
