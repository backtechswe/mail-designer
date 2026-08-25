import type { HeadingBlock } from "../types.js";
import { useEditor } from "../editor/EditorContext.js";
import { TextEditable } from "../editor/TextEditable.js";
import { headingStyle } from "./canvasStyle.js";

export function HeadingView({ block, active }: { block: HeadingBlock; active: boolean }) {
  const { doc, update, capabilities, t } = useEditor();
  return (
    <TextEditable
      as={`h${block.level}` as "h1" | "h2" | "h3"}
      active={active && capabilities(block).editContent}
      editable={capabilities(block).editContent}
      html={block.html}
      placeholder={t("block.heading")}
      style={headingStyle(block, doc.settings)}
      onChange={(html) => update(block.id, { html })}
    />
  );
}
