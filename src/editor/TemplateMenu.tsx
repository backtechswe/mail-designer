import { useCallback, useEffect, useRef, useState } from "react";
import type { MailPreset } from "../types.js";
import type { MailTemplateSummary, TemplateStore } from "../templates.js";
import { builtInPresets } from "../presets/index.js";
import { cloneBlock } from "../document.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";

/**
 * Templates menu, ready to drop into `toolbarExtra`.
 *
 * It talks only to the TemplateStore interface, so it works against localStorage, a REST
 * API, Firestore or anything else the host wires up — the package itself still ships no
 * database. Omit `store` and it becomes a starting-point picker with no persistence.
 *
 * `remove` on the store is optional, and the delete button follows it: a read-only
 * catalogue of company templates renders without one rather than showing a button that
 * cannot work.
 */
export function TemplateMenu({
  store,
  presets = builtInPresets,
}: {
  store?: TemplateStore;
  presets?: MailPreset[];
}) {
  const { doc, replaceDocument, select, confirm, t } = useEditor();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<MailTemplateSummary[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!store) return;
    try {
      setSaved(await store.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("templates.loadError"));
    }
  }, [store, t]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Click-outside and Escape, so the panel behaves like every other menu in the host app.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (next: Parameters<typeof replaceDocument>[0], name: string): void => {
    setOpen(false);
    // A wholesale replace is easy to trigger by mistake and hard to recognise afterwards, so
    // it asks — and the prompt says the undo is right there, which is what makes the answer
    // easy rather than frightening.
    confirm({
      title: t("confirm.switchTemplateTitle", { name }),
      body: t("confirm.switchTemplateBody"),
      confirmLabel: t("confirm.switchTemplateOk"),
      onConfirm: () => {
        // Fresh ids: applying the same preset twice must not produce colliding block ids.
        replaceDocument({ ...next, blocks: next.blocks.map((section) => cloneBlock(section)) });
        select(null);
      },
    });
  };

  const save = async (): Promise<void> => {
    if (!store) return;
    setBusy(true);
    setError(null);
    try {
      await store.save({ name: name.trim() || t("templates.title"), document: doc });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("templates.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="md-menu" ref={root}>
      <button type="button" className="md-menu-trigger" onClick={() => setOpen((v) => !v)}>
        <Icon name="templates" size={13} />
        {t("toolbar.templates")}
        <Icon name={open ? "up" : "down"} size={10} />
      </button>

      {open ? (
        <div className="md-menu-panel" role="menu">
          <p className="md-menu-warning">{t("templates.replaceWarning")}</p>

          <h4>{t("templates.presets")}</h4>
          <ul>
            {presets.map((preset) => (
              <li key={preset.id}>
                <button type="button" onClick={() => apply(preset.document, preset.name)}>
                  {preset.name}
                </button>
              </li>
            ))}
          </ul>

          {store ? (
            <>
              <h4>{t("templates.saved")}</h4>
              {saved.length === 0 ? (
                <p className="md-menu-empty">{t("templates.empty")}</p>
              ) : (
                <ul>
                  {saved.map((template) => (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          const full = await store.load(template.id);
                          if (full) apply(full.document, full.name);
                        }}
                      >
                        {template.name}
                      </button>
                      {store.remove ? (
                        <button
                          type="button"
                          className="md-icon-button md-danger"
                          title={t("action.delete")}
                          onClick={async () => {
                            await store.remove?.(template.id);
                            await refresh();
                          }}
                        >
                          <Icon name="trash" size={11} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="md-menu-save"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <input
                  type="text"
                  value={name}
                  placeholder={t("templates.namePrompt")}
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="md-secondary-button" disabled={busy}>
                  <Icon name="save" size={11} />
                  {t("toolbar.save")}
                </button>
              </form>
            </>
          ) : null}

          {error ? <p className="md-menu-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
