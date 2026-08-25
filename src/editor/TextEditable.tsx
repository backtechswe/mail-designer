import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sanitizeInline } from "../render/sanitize.js";
import { Icon } from "./icons.js";
import { useEditor } from "./EditorContext.js";
import { FieldPicker } from "../data/FieldPicker.js";
import { findTrigger, rankFields } from "../data/trigger.js";

/**
 * Inline rich text on a contenteditable, with a floating toolbar.
 *
 * Why not a rich-text engine: the whole vocabulary an email needs is bold, italic,
 * underline, a link and a colour. contenteditable produces exactly that markup, and every
 * tag it emits is one email clients render reliably. A full engine would add ~40 kB and its
 * own document model, then need constraining back down to this same subset.
 *
 * Two mechanics are load-bearing:
 *
 *  - React never owns this element's children. `dangerouslySetInnerHTML` looks like it sets
 *    the content once, but React diffs it and rewrites innerHTML on every render where the
 *    string changed — which is every keystroke, and rewriting innerHTML collapses the caret
 *    to position 0. So the content is written imperatively, and only when the incoming props
 *    differ from what is already in the DOM: on mount, on undo, on switching blocks. Never
 *    mid-word.
 *  - Paste is intercepted. An unfiltered paste from Word carries hundreds of styles and
 *    mso-* properties that survive into the sent email.
 */

export interface TextEditableProps {
  html: string;
  onChange: (html: string) => void;
  /** Applied to the editable element so it looks like the rendered email. */
  style?: React.CSSProperties;
  placeholder?: string;
  /** h1-h3 for a heading block, div for text. Only affects the wrapper element. */
  as?: "div" | "h1" | "h2" | "h3";
  active: boolean;
  /** False renders the text as plain output — the application owns these words. */
  editable?: boolean;
}

export function TextEditable({
  html,
  onChange,
  style,
  placeholder,
  as = "div",
  active,
  editable = true,
}: TextEditableProps) {
  const { t, dataFields, endEdit } = useEditor();
  const ref = useRef<HTMLElement | null>(null);
  // What the DOM currently holds, as far as we know. null means "nothing written yet".
  const domHtml = useRef<string | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  /**
   * The field picker. `from` is the offset of the trigger character, so choosing a field
   * replaces what the user has typed so far rather than leaving `@na` behind. Null `from`
   * means it was opened by the button and there is nothing to replace.
   */
  const [picker, setPicker] = useState<{
    top: number;
    left: number;
    query: string;
    node: Text | null;
    from: number | null;
  } | null>(null);

  // Write props into the DOM only when they did not come from us. Layout effect so the
  // initial content is present before the browser paints.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (domHtml.current === html) return;
    el.innerHTML = html;
    domHtml.current = html;
  }, [html]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = sanitizeInline(el.innerHTML);
    if (next === domHtml.current) return;
    domHtml.current = next;
    onChange(next);
  }, [onChange]);

  /**
   * Places the toolbar, and decides whether the field picker should be open.
   *
   * The toolbar follows a collapsed caret as well as a selection. Inserting a field happens at
   * a caret, so the old selection-only rule put the affordance at exactly the wrong moment —
   * and it meant bold could not be armed for text about to be typed either.
   */
  const syncCaret = useCallback(() => {
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) {
      setToolbar(null);
      setPicker(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    const top = rect.top - host.top;
    const left = Math.max(0, rect.left - host.left);
    setToolbar({ top: top - 40, left });

    const node = range.startContainer;
    if (!selection.isCollapsed || node.nodeType !== Node.TEXT_NODE) {
      setPicker(null);
      return;
    }
    const match = findTrigger((node as Text).data.slice(0, range.startOffset));
    // Only open when something actually matches. That is the second line of defence against
    // an email address — and it means a query that turns out to be ordinary prose closes the
    // menu rather than leaving it hanging with nothing in it.
    if (!match || rankFields(dataFields, match.query).length === 0) {
      setPicker(null);
      return;
    }
    setPicker({
      top: top + rect.height + 6,
      left,
      query: match.query,
      node: node as Text,
      from: match.from,
    });
  }, [dataFields]);

  useEffect(() => {
    if (!active) {
      setToolbar(null);
      setLinkDraft(null);
      setPicker(null);
      return;
    }
    const handler = (): void => syncCaret();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [active, syncCaret]);

  /**
   * execCommand is deprecated but not replaced: there is still no standard API for
   * "toggle bold on the current selection". The Range-based alternative means
   * reimplementing selection splitting, which is a great deal of code to arrive at the
   * same DOM. Every current browser still implements these four commands.
   */
  const exec = useCallback(
    (command: string, value?: string) => {
      ref.current?.focus();
      document.execCommand(command, false, value);
      emit();
    },
    [emit],
  );

  /**
   * Inserts `[field]` at the caret, replacing the partial `[que…` that opened the picker.
   * Going through execCommand rather than editing the DOM keeps the browser's own undo stack
   * and caret handling intact — the caret ends up after the token, ready to keep typing.
   */
  const insertField = useCallback(
    (field: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const selection = window.getSelection();
      const current = picker;
      if (selection && current?.node && current.from !== null) {
        const range = document.createRange();
        range.setStart(current.node, current.from);
        range.setEnd(current.node, Math.min(current.from + current.query.length + 1, current.node.data.length));
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand("insertText", false, `[${field}]`);
      setPicker(null);
      emit();
    },
    [emit, picker],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      const clipboard = event.clipboardData;
      const asHtml = clipboard.getData("text/html");
      if (asHtml) {
        // Sanitising here is what stops a Word paste from carrying its stylesheet along.
        document.execCommand("insertHTML", false, sanitizeInline(asHtml));
      } else {
        document.execCommand("insertText", false, clipboard.getData("text/plain"));
      }
      emit();
    },
    [emit],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // The picker owns arrows, Enter, Tab and Escape while it is open; it captures them at the
    // document, so all this has to do is stay out of the way.
    if (event.key === "Escape") {
      (event.target as HTMLElement).blur();
      return;
    }
    // Alt+arrow moves the *block*, not the caret, so it belongs to the canvas even while
    // text has focus. Everything else stays here — Backspace must delete a character, not
    // the block the caret is sitting in.
    if (event.altKey && event.key.startsWith("Arrow")) return;
    event.stopPropagation();
  }, []);

  const Tag = as as "div";
  const isEmpty = !html || html === "<br>" || sanitizeInline(html).replace(/<[^>]*>/g, "").trim() === "";

  return (
    <div className="md-texteditable" style={{ position: "relative" }}>
      {editable && active && toolbar ? (
        <div className="md-floating-toolbar" style={{ top: toolbar.top, left: toolbar.left }}>
          {linkDraft === null ? (
            <>
              <ToolbarButton label={t("text.bold")} icon="bold" onClick={() => exec("bold")} />
              <ToolbarButton label={t("text.italic")} icon="italic" onClick={() => exec("italic")} />
              <ToolbarButton
                label={t("text.underline")}
                icon="underline"
                onClick={() => exec("underline")}
              />
              <ToolbarButton label={t("text.link")} icon="link" onClick={() => setLinkDraft("https://")} />
              <ToolbarButton
                label={t("text.unlink")}
                icon="unlink"
                onClick={() => exec("unlink")}
              />
              <label className="md-toolbar-color" title={t("text.color")}>
                <Icon name="palette" size={14} />
                <input
                  type="color"
                  onChange={(e) => exec("foreColor", e.target.value)}
                  aria-label={t("text.color")}
                />
              </label>
              {dataFields.length > 0 ? (
                <button
                  type="button"
                  className="md-toolbar-field"
                  title={t("data.insertHint")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    // Opens the same list the `[` trigger does, at the caret, with nothing to
                    // replace. The button is here to teach the shortcut, not to replace it.
                    if (toolbar) {
                      setPicker({
                        top: toolbar.top + 40 + 6,
                        left: toolbar.left,
                        query: "",
                        node: null,
                        from: null,
                      });
                    }
                  }}
                >
                  <Icon name="tag" size={13} />
                  {t("data.insert")}
                </button>
              ) : null}
            </>
          ) : (
            <form
              className="md-toolbar-link"
              onSubmit={(e) => {
                e.preventDefault();
                const url = linkDraft.trim();
                setLinkDraft(null);
                if (url && url !== "https://") exec("createLink", url);
              }}
            >
              <input
                type="text"
                autoFocus
                value={linkDraft}
                placeholder={t("text.linkPrompt")}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") setLinkDraft(null);
                }}
              />
              <button type="submit" title={t("action.confirm")}>
                <Icon name="check" size={13} />
              </button>
            </form>
          )}
        </div>
      ) : null}

      {editable && picker ? (
        <FieldPicker
          top={picker.top}
          left={picker.left}
          query={picker.query}
          onSelect={insertField}
          onClose={() => setPicker(null)}
        />
      ) : null}

      <Tag
        ref={ref as React.Ref<HTMLDivElement>}
        className={`md-editable${editable ? "" : " md-editable--locked"}`}
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck
        data-placeholder={isEmpty ? (placeholder ?? "") : undefined}
        style={style}
        onInput={emit}
        // Leaving the block ends the merge run: coming back to it later is a new edit, not
        // a continuation of the last one.
        onBlur={() => {
          emit();
          endEdit();
        }}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // mousedown, not click: clicking would move focus out of the contenteditable and
      // collapse the selection before the command could run.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
