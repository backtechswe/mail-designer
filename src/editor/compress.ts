/**
 * Shrink an image before it is uploaded.
 *
 * Why this belongs in the editor rather than in the host application: the person adding the
 * picture is holding a 4000px photo from a phone, the column it goes into is 600px wide, and
 * nothing between those two facts will fix itself. Image weight is the main reason a mail is
 * slow on mobile data, and for data: URIs it is what pushes a message past Gmail's 102 kB
 * clipping limit. Every host would otherwise write this same function.
 *
 * Browser APIs only — canvas and `createImageBitmap` — so it adds no dependency. It runs in
 * the editor, never on a server, and it is a no-op outside a browser.
 */

export interface CompressOptions {
  /**
   * Largest width to keep, in pixels. The default is twice the mail's content width, which is
   * what a retina screen actually uses; anything beyond that is bytes nobody sees.
   */
  maxWidth?: number;
  /** JPEG quality, 0–1. 0.82 is the point where artefacts stop being visible on photographs. */
  quality?: number;
  /** Don't touch anything already smaller than this. Default 40 kB. */
  minBytes?: number;
}

export interface CompressResult {
  file: File;
  /** Bytes before and after, for telling the user what happened. */
  before: number;
  after: number;
  width: number;
  height: number;
  /** False when the original was returned untouched, and why. */
  changed: boolean;
  reason?: "smaller-already" | "unsupported" | "grew" | "failed";
}

const PASS_THROUGH = /^image\/(gif|svg\+xml|avif)$/;

function unchanged(file: File, reason: CompressResult["reason"]): CompressResult {
  return { file, before: file.size, after: file.size, width: 0, height: 0, changed: false, reason };
}

/**
 * Re-encode `file` no wider than `maxWidth`.
 *
 * Transparency decides the format, and email decides the rest: a PNG with an alpha channel
 * stays a PNG, because flattening it onto white is exactly the bug that makes a logo a white
 * box in dark mode. Everything else becomes JPEG — not WebP, which Outlook on Windows still
 * does not render. Animated GIF and SVG are returned untouched; a canvas would freeze the
 * first and rasterise the second.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const maxWidth = options.maxWidth ?? 1280;
  const quality = options.quality ?? 0.82;
  const minBytes = options.minBytes ?? 40_000;

  // Facts about the file first, facts about the runtime second: a caller deciding whether to
  // tell the user something is more helped by "already small" than by "no canvas here".
  if (!file.type.startsWith("image/") || PASS_THROUGH.test(file.type)) {
    return unchanged(file, "unsupported");
  }
  if (file.size <= minBytes) return unchanged(file, "smaller-already");
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return unchanged(file, "unsupported");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return unchanged(file, "failed");
  }

  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return unchanged(file, "failed");
    // Browsers do a box filter by default, which turns a downscaled photograph to mush.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const keepAlpha = await hasTransparency(file, context, width, height);
    const type = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await toBlob(canvas, type, quality);
    if (!blob) return unchanged(file, "failed");

    // Re-encoding can make a file bigger — a small PNG screenshot pushed through JPEG is the
    // usual case. Then the original is simply the better file.
    if (blob.size >= file.size) return unchanged(file, "grew");

    const name = file.name.replace(/\.[^.]+$/, "") + (keepAlpha ? ".png" : ".jpg");
    return {
      file: new File([blob], name, { type, lastModified: file.lastModified }),
      before: file.size,
      after: blob.size,
      width,
      height,
      changed: true,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Whether the image has any pixel that is not fully opaque.
 *
 * Cheaper than it sounds and worth doing properly: assuming from the MIME type would keep
 * every screenshot as a PNG, and assuming the opposite would flatten a transparent logo onto
 * white. Only PNG and WebP can carry alpha at all, so nothing else is even sampled.
 */
async function hasTransparency(
  file: File,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<boolean> {
  if (file.type !== "image/png" && file.type !== "image/webp") return false;
  try {
    const { data } = context.getImageData(0, 0, width, height);
    // Every fourth byte is alpha. Step over pixels rather than reading each one: a single
    // transparent pixel is enough, and a 4-pixel stride finds any real transparent region.
    for (let i = 3; i < data.length; i += 16) {
      if ((data[i] ?? 255) < 255) return true;
    }
    return false;
  } catch {
    // A cross-origin source taints the canvas. Assume alpha: keeping a PNG is the safe error.
    return true;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** "2,4 MB → 180 kB", for saying what happened without a unit nobody reads. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
