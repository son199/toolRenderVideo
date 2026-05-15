/**
 * Compute a font size that keeps `text` within `maxWidthPx` over at most
 * `maxLines` lines. Uses character-count heuristic (no DOM measurement —
 * Remotion render-time doesn't allow ResizeObserver-style relayout).
 *
 * Tuned for Inter/Outfit/Fraunces at weight 700-900 with Vietnamese diacritics.
 * `avgCharWidthRatio` is the average glyph width as a fraction of em — empirical
 * value 0.55 for sans-serif uppercase, 0.5 for mixed case, 0.45 for italic serif.
 */
export interface AutoFitOpts {
  maxWidthPx: number;
  maxLines: number;
  basePx: number;
  minPx: number;
  maxPx?: number;
  avgCharWidthRatio?: number;
  uppercase?: boolean;
}

export function autoFitFontSize(text: string, opts: AutoFitOpts): number {
  const {
    maxWidthPx,
    maxLines,
    basePx,
    minPx,
    maxPx = basePx,
    avgCharWidthRatio,
    uppercase = false,
  } = opts;

  const clean = (text || "").trim();
  if (!clean) return basePx;

  const ratio = avgCharWidthRatio ?? (uppercase ? 0.58 : 0.5);
  const totalChars = clean.length;

  // Capacity: how many chars fit per line at `basePx`
  const charsPerLineAtBase = Math.max(1, Math.floor(maxWidthPx / (basePx * ratio)));
  const linesAtBase = Math.ceil(totalChars / charsPerLineAtBase);

  if (linesAtBase <= maxLines) {
    return Math.min(maxPx, basePx);
  }

  // Need to shrink so that `totalChars / (maxLines)` chars fit per line.
  const charsPerLineNeeded = Math.ceil(totalChars / maxLines);
  const shrunk = Math.floor(maxWidthPx / (charsPerLineNeeded * ratio));
  return Math.max(minPx, Math.min(maxPx, shrunk));
}

/**
 * For a long word (no spaces) — find the largest font size that lets the
 * single word fit on one line within maxWidthPx.
 */
export function autoFitSingleWord(word: string, maxWidthPx: number, basePx: number, minPx: number, ratio = 0.58): number {
  if (!word) return basePx;
  const fit = Math.floor(maxWidthPx / (word.length * ratio));
  return Math.max(minPx, Math.min(basePx, fit));
}
