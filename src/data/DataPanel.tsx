import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../editor/EditorContext.js";
import { Icon } from "../editor/icons.js";
import { dataCoverage } from "../permissions.js";

/**
 * Sample data for the preview, in two representations that mirror each other.
 *
 * Both are always visible, side by side, because they suit different moments: filling in four
 * values is faster in fields, and pasting a payload from a real request is only sensible as
 * JSON. Neither is a mode you have to switch into, so nobody has to find the switch.
 *
 * The data object is the single source of truth. The JSON side keeps a draft string so a
 * half-typed brace does not wipe the fields; it commits on every parse that succeeds and says
 * so when it cannot.
 */
export function DataPanel({ onClose }: { onClose: () => void }) {
  const { doc, data, setData, permissions, t } = useEditor();
  const readonly = permissions.data === "readonly";

  const coverage = useMemo(
    () => dataCoverage(doc, data, permissions.requiredFields),
    [doc, data, permissions.requiredFields],
  );

  return (
    <section className="md-datapanel" aria-label={t("data.panel")}>
      <header>
        <strong>{t("data.panel")}</strong>
        <Coverage coverage={coverage} />
        <span className="md-datapanel-spacer" />
        <button
          type="button"
          className="md-icon-button"
          title={t("action.close")}
          aria-label={t("action.close")}
          onClick={onClose}
        >
          <Icon name="close" size={11} />
        </button>
      </header>

      <p className="md-datapanel-hint">{readonly ? t("data.readonly") : t("data.panelHint")}</p>

      <div className="md-datapanel-split">
        <Fields data={data} setData={setData} coverage={coverage} readonly={readonly} />
        <JsonView data={data} setData={setData} readonly={readonly} />
      </div>
    </section>
  );
}

function Coverage({ coverage }: { coverage: ReturnType<typeof dataCoverage> }) {
  const { t } = useEditor();

  if (coverage.missingRequired.length > 0) {
    return (
      <span className="md-coverage md-coverage--error">
        {t("data.coverageRequired", { fields: coverage.missingRequired.join(", ") })}
      </span>
    );
  }
  if (coverage.unused.length > 0) {
    const fields = coverage.unused.join(", ");
    return (
      <span className="md-coverage md-coverage--warn">
        {coverage.unused.length === 1
          ? t("data.coverageMissingOne", { fields })
          : t("data.coverageMissingMany", { count: coverage.unused.length, fields })}
      </span>
    );
  }
  if (coverage.used.length > 0) {
    return <span className="md-coverage md-coverage--ok">{t("data.coverageOk")}</span>;
  }
  return null;
}

function Fields({
  data,
  setData,
  coverage,
  readonly,
}: {
  data: Record<string, string>;
  setData: (next: Record<string, string>) => void;
  coverage: ReturnType<typeof dataCoverage>;
  readonly: boolean;
}) {
  const { t, selectedId, insertDataField } = useEditor();
  const shown = new Set(coverage.used.map((f) => f.toLowerCase()));
  const entries = Object.entries(data);

  const rename = (from: string, to: string): void => {
    if (!to.trim() || to === from) return;
    // Rebuild rather than delete-and-add, so a rename keeps the field where it was in the
    // list instead of jumping to the end.
    setData(Object.fromEntries(entries.map(([k, v]) => (k === from ? [to.trim(), v] : [k, v]))));
  };

  return (
    <div className="md-datafields">
      {entries.length === 0 ? (
        <p className="md-datapanel-empty">{t("data.none")}</p>
      ) : (
        <ul>
          {entries.map(([key, value]) => {
            const used = shown.has(key.toLowerCase());
            return (
              <li key={key}>
                <input
                  type="text"
                  className="md-mono"
                  value={key}
                  aria-label={t("data.fieldName")}
                  disabled={readonly}
                  onChange={(e) => rename(key, e.target.value)}
                />
                <input
                  type="text"
                  value={value}
                  aria-label={t("data.fieldValue")}
                  placeholder={t("data.noValue")}
                  disabled={readonly}
                  onChange={(e) => setData({ ...data, [key]: e.target.value })}
                />
                <span
                  className={`md-fieldstate${used ? "" : " md-fieldstate--unused"}`}
                  title={used ? t("data.used") : t("data.unused")}
                  aria-label={used ? t("data.used") : t("data.unused")}
                >
                  {used ? "●" : "○"}
                </span>
                {/* Inserting the token is the point of knowing a field exists, so the
                    shortcut lives here too, not only in the text toolbar. */}
                <button
                  type="button"
                  className="md-icon-button"
                  disabled={!selectedId}
                  title={t("data.insertField", { field: `[${key}]` })}
                  onClick={() => insertDataField(key)}
                >
                  <Icon name="tag" size={11} />
                </button>
                {readonly ? null : (
                  <button
                    type="button"
                    className="md-icon-button md-danger"
                    title={t("action.delete")}
                    onClick={() => setData(Object.fromEntries(entries.filter(([k]) => k !== key)))}
                  >
                    <Icon name="trash" size={11} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {readonly ? null : (
        <button
          type="button"
          className="md-secondary-button"
          onClick={() => {
            let name = "Fält";
            let n = 1;
            while (name in data) name = `Fält ${++n}`;
            setData({ ...data, [name]: "" });
          }}
        >
          <Icon name="plus" size={11} />
          {t("data.addField")}
        </button>
      )}
    </div>
  );
}

function JsonView({
  data,
  setData,
  readonly,
}: {
  data: Record<string, string>;
  setData: (next: Record<string, string>) => void;
  readonly: boolean;
}) {
  const { t } = useEditor();
  const serialised = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [draft, setDraft] = useState(serialised);
  const [invalid, setInvalid] = useState(false);
  // What we last parsed out of the draft. Lets us tell "the fields changed" from "our own
  // edit came back", so typing here is not interrupted by a reformat on every keystroke.
  const ours = useRef(serialised);

  useEffect(() => {
    if (serialised === ours.current) return;
    ours.current = serialised;
    setDraft(serialised);
    setInvalid(false);
  }, [serialised]);

  const onChange = (next: string): void => {
    setDraft(next);
    try {
      const parsed = JSON.parse(next);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      // Values are stringified here: everything ends up substituted into text, and a number
      // that silently became "[object Object]" at send time would be worse than one coerced
      // where it can be seen.
      const flat = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
          k,
          typeof v === "string" ? v : v === null || v === undefined ? "" : String(v),
        ]),
      );
      ours.current = JSON.stringify(flat, null, 2);
      setData(flat);
    } catch {
      setInvalid(true);
    }
  };

  return (
    <div className="md-datajson">
      <textarea
        className="md-mono"
        spellCheck={false}
        value={draft}
        aria-label={t("data.jsonView")}
        readOnly={readonly}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid ? <p className="md-datajson-error">{t("data.jsonInvalid")}</p> : null}
    </div>
  );
}
