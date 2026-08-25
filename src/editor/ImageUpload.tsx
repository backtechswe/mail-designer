import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageBlock } from "../types.js";
import { useEditor } from "./EditorContext.js";
import { compressImage, formatBytes } from "./compress.js";
import type { CompressResult } from "./compress.js";
import { Icon } from "./icons.js";
import { Field } from "./fields/index.js";

/** Widths worth offering. 640 is a full-width mail; the rest are retina multiples of it. */
const WIDTHS = [640, 1280, 1920, 0] as const;

/**
 * Picking a picture, and deciding how hard to squeeze it.
 *
 * Three things this replaces. A bare `<input type="file">`, whose button belongs to the
 * browser and looks it. A URL field showing 20 kB of base64 after every upload — a value
 * nobody reads and nobody can edit. And a compression setting the user had no say in, which
 * is fine until the one time the photo matters more than the kilobytes.
 *
 * The original file is kept in memory for exactly that reason: adjusting quality re-encodes
 * *it*, never the already-compressed result. Re-compressing a JPEG repeatedly is how an image
 * quietly turns to mush over a few slider passes.
 *
 * Sliding shows the new size without uploading; releasing uploads once. That split matters —
 * a host's `onUploadImage` writes to storage it pays for, and a slider that uploaded on every
 * frame would leave a trail of orphaned files behind every adjustment.
 */
export function ImageUpload({ block }: { block: ImageBlock }) {
  const { update, onUploadImage, compressImage: bound, doc, t } = useEditor();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [quality, setQuality] = useState(82);
  const [maxWidth, setMaxWidth] = useState<number>(doc.settings.width * 2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const pending = useRef<number | null>(null);
  /**
   * Which preview is the current one.
   *
   * Compressing at quality 100 takes several times as long as at 40, so dragging the slider
   * fast starts a slow job and then a quick one — and the slow one finishes last. Without
   * this the panel settles on the number for a setting the user has already moved away from.
   */
  const latest = useRef(0);
  /**
   * One compression at a time, and only the newest settings are ever waiting.
   *
   * Re-encoding a large photo takes about a second; a slider that queued one per step would
   * spend a minute catching up with a two-second drag. Anything requested while a job runs
   * replaces whatever was queued, so the work done is proportional to where the slider comes
   * to rest rather than to how it got there.
   */
  const running = useRef(false);
  const queued = useRef<{ q: number; w: number } | null>(null);

  useEffect(() => {
    return () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    };
  }, []);

  /**
   * Compress with the settings passed in, never with the settings in state.
   *
   * That is not fussiness. `setQuality(next)` does not change `quality` until the next
   * render, so a handler that called a `quality`-bound helper right after setting it
   * compressed with the *previous* value — the slider moved and the number never did.
   */
  const squeeze = useCallback(
    (file: File, q: number, w: number): Promise<CompressResult> =>
      bound
        ? compressImage(file, { maxWidth: w || Number.MAX_SAFE_INTEGER, quality: q / 100 })
        : Promise.resolve({
            file,
            before: file.size,
            after: file.size,
            width: 0,
            height: 0,
            changed: false,
          }),
    [bound],
  );

  const accept = useCallback(
    async (file: File) => {
      if (!onUploadImage) return;
      setBusy(true);
      setError(null);
      setOriginal(file);
      try {
        const compressed = await squeeze(file, quality, maxWidth);
        setResult(compressed);
        update(block.id, { src: await onUploadImage(compressed.file) });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploadImage, squeeze, update, block.id, quality, maxWidth],
  );

  /** Runs the queued settings, then whatever arrived while it was busy. */
  const drain = useCallback(async () => {
    if (running.current || !original) return;
    running.current = true;
    try {
      while (queued.current) {
        const { q, w } = queued.current;
        queued.current = null;
        const ticket = ++latest.current;
        const next = await squeeze(original, q, w);
        if (ticket === latest.current) setResult(next);
      }
    } finally {
      running.current = false;
      setMeasuring(false);
    }
  }, [original, squeeze]);

  /** While dragging the slider: recompress locally so the size updates, but upload nothing. */
  const preview = useCallback(
    (q: number, w: number) => {
      if (!original) return;
      if (pending.current !== null) window.clearTimeout(pending.current);
      setMeasuring(true);
      pending.current = window.setTimeout(() => {
        queued.current = { q, w };
        void drain();
      }, 250);
    },
    [original, squeeze],
  );

  /** On release: one upload, with what the user settled on. */
  const commit = useCallback(
    async (q: number, w: number) => {
      if (!original || !onUploadImage) return;
      if (pending.current !== null) window.clearTimeout(pending.current);
      const ticket = ++latest.current;
      setBusy(true);
      setMeasuring(false);
      try {
        const compressed = await squeeze(original, q, w);
        if (ticket !== latest.current) return;
        setResult(compressed);
        update(block.id, { src: await onUploadImage(compressed.file) });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [original, onUploadImage, squeeze, update, block.id],
  );

  if (!onUploadImage) return null;

  return (
    <>
      <Field label={t("field.upload")} hint={error ?? undefined}>
        <div
          className={dragging ? "md-drop is-dragging" : "md-drop"}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void accept(file);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <Icon name="upload" size={16} />
          <span className="md-drop-label">{busy ? t("field.uploading") : t("field.dropHint")}</span>
          {/* The real input, kept out of sight: its button is the browser's, not ours. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void accept(file);
            }}
          />
        </div>
      </Field>

      {original ? (
        <div className="md-compress">
          <div className="md-compress-head">
            <span className="md-compress-name" title={original.name}>
              {original.name}
            </span>
            <span className={measuring ? "md-compress-size is-measuring" : "md-compress-size"}>
              {result?.changed
                ? `${formatBytes(result.before)} → ${formatBytes(result.after)}`
                : formatBytes(original.size)}
            </span>
          </div>

          <label className="md-compress-row">
            <span>{t("field.quality")}</span>
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={quality}
              disabled={busy}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuality(next);
                preview(next, maxWidth);
              }}
              // React's onChange fires throughout the drag; pointerup and keyup are where the
              // gesture actually ends, and where the one upload belongs.
              onPointerUp={() => void commit(quality, maxWidth)}
              onKeyUp={() => void commit(quality, maxWidth)}
            />
            <span className="md-compress-value">{quality}</span>
          </label>

          <label className="md-compress-row">
            <span>{t("field.maxWidth")}</span>
            <select
              value={maxWidth}
              disabled={busy}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMaxWidth(next);
                // A width change is one decision, not a drag: compress and upload now.
                void commit(quality, next);
              }}
            >
              {WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width === 0 ? t("field.originalSize") : `${width} px`}
                </option>
              ))}
            </select>
          </label>

          {result?.reason === "grew" ? (
            <p className="md-compress-note">{t("field.compressGrew")}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
