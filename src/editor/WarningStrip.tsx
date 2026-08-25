import { useMemo } from "react";
import type { MailDocument, RenderResult } from "../types.js";
import { inspectEmail } from "../render/inspect.js";
import type { EmailWarning } from "../render/inspect.js";
import { useEditor } from "./EditorContext.js";
import type { StringKey } from "../i18n.js";

/**
 * What a preview cannot show.
 *
 * These failures all look fine in a browser and then go wrong in a real inbox — a mail Gmail
 * truncates, an image Gmail refuses to load, a background Outlook drops. Sitting above the
 * preview is the right place for them: it is the moment someone is deciding the mail is
 * finished.
 */
export function WarningStrip({ doc, result }: { doc: MailDocument; result: RenderResult }) {
  const { t } = useEditor();
  const warnings = useMemo(() => inspectEmail(doc, result), [doc, result]);
  if (warnings.length === 0) return null;

  return (
    <div className="md-warnings" role="status">
      <strong>{t("warn.title")}</strong>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.id} className={`md-warn--${warning.level}`}>
            {t(`warn.${warning.id}` as StringKey, values(warning))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function values(warning: EmailWarning): Record<string, string | number> {
  return {
    count: warning.blocks?.length ?? 0,
    // Rounded to whole kB: the exact byte count is not what anyone acts on.
    kb: Math.round(Number(warning.detail?.bytes ?? 0) / 1024),
    width: Number(warning.detail?.width ?? 0),
  };
}
