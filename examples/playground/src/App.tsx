import { useMemo, useState } from "react";
import { toHtml, builtInPresets, extractMergeFields } from "@backtech/mail-designer";
import type { MailDocument } from "@backtech/mail-designer";

/**
 * Part 1 milestone: prove the renderer end to end before any editor exists. Pick a preset,
 * see the real compiled HTML in an iframe next to its source, and switch between desktop
 * and mobile width to check that columns stack.
 *
 * The editor replaces the left pane in part 2a; this view stays as the preview.
 */
export function App() {
  const [presetId, setPresetId] = useState(builtInPresets[1]!.id);
  const [width, setWidth] = useState(600);
  const [view, setView] = useState<"html" | "text">("html");
  const [name, setName] = useState("Anna & Co");

  const doc: MailDocument = useMemo(
    () => builtInPresets.find((p) => p.id === presetId)!.document,
    [presetId],
  );

  const fields = useMemo(() => extractMergeFields(doc), [doc]);
  const rendered = useMemo(
    () => toHtml(doc, { title: "Playground", mergeValues: { Namn: name } }),
    [doc, name],
  );

  return (
    <div className="pg">
      <div className="pg-bar">
        <strong>mail-designer</strong>
        <label>
          Mall
          <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {builtInPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pg-toggle">
          {[
            { w: 600, label: "Desktop" },
            { w: 375, label: "Mobil" },
          ].map(({ w, label }) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === w}
              onClick={() => setWidth(w)}
            >
              {label} {w}
            </button>
          ))}
        </span>
        <label>
          [Namn]
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Visa
          <select value={view} onChange={(e) => setView(e.target.value as "html" | "text")}>
            <option value="html">HTML</option>
            <option value="text">Text</option>
          </select>
        </label>
        <span style={{ fontSize: 12, color: "#8c8c8c" }}>
          Merge-fält: {fields.length ? fields.join(", ") : "inga"}
        </span>
      </div>

      <div className="pg-split">
        <div className="pg-pane">
          <h2>Förhandsvisning ({width} px)</h2>
          <div className="pg-preview">
            {/* srcDoc, not a blob URL: the iframe reloads on every keystroke and a blob
                would leak one object URL per render. */}
            <iframe title="Förhandsvisning" srcDoc={rendered.html} style={{ width }} />
          </div>
        </div>
        <div className="pg-pane">
          <h2>{view === "html" ? "Genererad HTML" : "Textversion"}</h2>
          <pre className="pg-source">{view === "html" ? rendered.html : rendered.text}</pre>
        </div>
      </div>
    </div>
  );
}
