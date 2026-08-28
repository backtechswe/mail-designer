import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHtml } from "../render/format.js";
import { toHtml } from "../render/toHtml.js";
import { emailSize, GMAIL_CLIP_BYTES } from "../render/inspect.js";
import { useEditor } from "./EditorContext.js";
import { WarningStrip } from "./WarningStrip.js";
import { highlightHtml, highlightJson } from "./highlight.js";
import { messageSummary } from "./message.js";
import { coerceDocument, validateDocument } from "../validate.js";
import { Icon } from "./icons.js";

type Format = "html" | "text" | "json";

/**
 * The output, as output.
 *
 * An editor that will not show you what it produces asks to be trusted. This is also the
 * handover point to everything downstream — an ESP's template field, a Cloud Function, a file
 * in a repo — so the three things worth having are all here: the HTML, the plain-text
 * alternative that any real mailing needs beside it, and the document itself, which is what
 * you store and what a template is.
 *
 * The sample-data switch is the one that matters in practice. Sending through Brevo or
 * SendGrid you keep `[Name]` and let them substitute; rendering per recipient yourself you
 * substitute here. Both are one click, because getting it wrong means either a mail full of
 * brackets or a template that is already filled in for one person.
 */
export function CodeView() {
  const { doc, data, permissions, replaceDocument, t } = useEditor();

  /*
   * Pasting a document replaces structure, content and appearance in one go, so it takes all
   * three permissions rather than just the one that opened the tab. A host that locked any of
   * them did not mean "unless you use the code view".
   *
   * Deliberately only on the document tab. Reading HTML back into blocks would mean inferring
   * structure from nested tables, ghost tables and MSO conditionals — the renderer destroys
   * that structure on purpose to survive Outlook — and it would fail on any HTML this renderer
   * did not write, which is most of the HTML anyone would paste. An html block is the honest
   * home for a fragment from elsewhere.
   */
  const mayReplace =
    permissions.structure !== false &&
    permissions.content !== false &&
    permissions.appearance !== false;
  const allowed = (["html", "text", "json"] as const).filter((id) => permissions.code[id]);
  const [format, setFormat] = useState<Format>(allowed[0] ?? "html");
  const [withData, setWithData] = useState(false);
  const [pretty, setPretty] = useState(true);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const rendered = useMemo(
    () => toHtml(doc, withData && data ? { data } : {}),
    [doc, data, withData],
  );

  const source = useMemo(() => {
    if (format === "html") return pretty ? formatHtml(rendered.html) : rendered.html;
    if (format === "text") return rendered.text;
    return JSON.stringify(doc, null, 2);
  }, [format, rendered, doc, pretty]);

  const editable = format === "json" && mayReplace;

  /*
   * A draft, not a controlled mirror of the document. `ours` records what we last rendered
   * from the document, so a change made elsewhere in the editor refreshes the box while what
   * the user is typing is left alone — the same shape the sample-data JSON box uses.
   */
  const [draft, setDraft] = useState(source);
  const [problem, setProblem] = useState<string | null>(null);
  const ours = useRef(source);

  useEffect(() => {
    if (source === ours.current) return;
    ours.current = source;
    setDraft(source);
    setProblem(null);
  }, [source]);

  /*
   * Applied on a click rather than as you type. A document is not a field: applying every
   * keystroke would fill the undo stack with half-parsed documents and could throw away work
   * mid-edit. One action, one undo step, and the old document is one ctrl-z away.
   */
  const apply = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setProblem(t("code.invalidJson"));
      return;
    }
    const result = validateDocument(parsed);
    if (!result.ok) {
      const first = result.issues[0];
      setProblem(t("code.invalidDocument", { issue: first ? `${first.path}: ${first.message}` : "" }));
      return;
    }
    setProblem(null);
    // Coerced, not used as parsed: a document written by an older release or by hand may be
    // missing fields the editor expects, and repairing beats refusing.
    replaceDocument(coerceDocument(parsed));
  }, [draft, replaceDocument, t]);

  const highlighted = useMemo(() => {
    if (format === "html") return highlightHtml(source);
    if (format === "json") return highlightJson(source);
    return null;
  }, [format, source]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    const done = (): void => {
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    };
    // The async clipboard needs a secure context; the textarea fallback works on plain http,
    // which is where a playground or an internal tool often lives.
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(source).then(done, () => fallbackCopy(source, done));
    } else {
      fallbackCopy(source, done);
    }
  }, [source]);

  const download = useCallback(() => {
    const name = slug(messageSummary(doc).subject) || "mail";
    const extension = format === "json" ? "json" : format === "text" ? "txt" : "html";
    const type =
      format === "json" ? "application/json" : format === "text" ? "text/plain" : "text/html";
    const url = URL.createObjectURL(new Blob([source], { type: `${type};charset=utf-8` }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.${extension}`;
    link.click();
    // Revoke on the next frame: revoking synchronously can beat the download starting.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }, [source, format, doc]);

  const bytes = emailSize(rendered.html);
  const heavy = bytes > GMAIL_CLIP_BYTES;

  return (
    <div className="md-code">
      <WarningStrip doc={doc} result={rendered} />

      <div className="md-code-bar">
        {allowed.length > 1 ? (
          <div className="md-toolbar-group md-segmented">
            {allowed.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={format === id}
                onClick={() => setFormat(id)}
              >
                {t(`code.${id}` as const)}
              </button>
            ))}
          </div>
        ) : null}

        {format === "json" ? null : (
          <label className="md-code-toggle">
            <input
              type="checkbox"
              checked={withData}
              onChange={(event) => setWithData(event.target.checked)}
            />
            {t("code.withData")}
          </label>
        )}

        {format === "html" ? (
          <label className="md-code-toggle">
            <input
              type="checkbox"
              checked={pretty}
              onChange={(event) => setPretty(event.target.checked)}
            />
            {t("code.pretty")}
          </label>
        ) : null}

        <span className="md-code-spacer" />

        {format === "html" ? (
          <span className={heavy ? "md-code-size is-heavy" : "md-code-size"}>
            {t("code.size", { size: (bytes / 1024).toFixed(1) })}
          </span>
        ) : null}

        {editable ? (
          <button
            type="button"
            className="md-menu-trigger"
            disabled={draft === source}
            onClick={apply}
          >
            <Icon name="check" size={12} />
            {t("code.apply")}
          </button>
        ) : null}

        <button type="button" className="md-menu-trigger" onClick={copy}>
          <Icon name={copied ? "check" : "copy"} size={12} />
          {copied ? t("code.copied") : t("code.copy")}
        </button>
        <button type="button" className="md-menu-trigger" onClick={download}>
          <Icon name="save" size={12} />
          {t("code.download")}
        </button>
      </div>

      {editable ? (
        <>
          <textarea
            className="md-code-body md-code-editor"
            value={draft}
            spellCheck={false}
            aria-label={t("code.json")}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem(null);
            }}
          />
          {problem ? <p className="md-code-problem">{problem}</p> : null}
        </>
      ) : (
        <pre className="md-code-body">
          {highlighted === null ? (
            <code>{source}</code>
          ) : (
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          )}
        </pre>
      )}
    </div>
  );
}

function fallbackCopy(text: string, done: () => void): void {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
    done();
  } finally {
    area.remove();
  }
}

/** A filename from the subject: lowercase, words joined by hyphens, no surprises. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
