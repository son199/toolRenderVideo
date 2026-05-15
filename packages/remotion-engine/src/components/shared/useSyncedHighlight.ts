import { useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTiming } from "./useSceneTiming";

export interface SyncedHighlightResult {
  /** Which item is currently being explained (-1 before first, items.length after last). */
  activeIndex: number;
  /** Time (seconds) when each item becomes active. Length = items.length. */
  itemStartTimes: number[];
  /** Total active span (seconds) — usually first word start → last word end. */
  spanStart: number;
  spanEnd: number;
}

interface UseSyncedHighlightOpts {
  /** Item-text-length-weighted distribution. When false → equal time per item. */
  proportionalToLength?: boolean;
  /** Per-item explicit phrases (length must equal items.length). When provided,
   * the hook uses the START of each phrase inside the timing stream as the
   * activation boundary instead of pure time-division. Falls back silently. */
  itemPhrases?: string[];
  /** Optional seconds of pre-roll before the first item activates (so the
   * narration intro plays before any highlight appears). Default 0. */
  introLeadSec?: number;
}

/**
 * Decide which bullet/item is currently being explained, given the scene's
 * `word_timings` and the list of `items`.
 *
 * Two strategies:
 * 1. `itemPhrases` provided → match each phrase's first content word inside
 *    `timings` to anchor that item's start time. Best quality.
 * 2. Otherwise → divide the active audio span into N buckets, optionally
 *    weighted by each item's text length so verbose items get more dwell.
 */
export function useSyncedHighlight(
  items: { label?: string; text?: string }[] | string[],
  timings: WordTiming[],
  opts: UseSyncedHighlightOpts = {},
): SyncedHighlightResult {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps;

  const labels: string[] = items.map((it) =>
    typeof it === "string" ? it : (it.label ?? it.text ?? ""),
  );
  const n = labels.length;

  if (n === 0 || timings.length === 0) {
    return { activeIndex: -1, itemStartTimes: [], spanStart: 0, spanEnd: 0 };
  }

  const spanStart = Math.max(0, timings[0].start) + (opts.introLeadSec ?? 0);
  const spanEnd = Math.max(spanStart, timings[timings.length - 1].end);
  const totalSpan = Math.max(0.0001, spanEnd - spanStart);

  // Strategy 1: phrase matching
  if (opts.itemPhrases && opts.itemPhrases.length === n) {
    const starts = matchPhraseStarts(opts.itemPhrases, timings);
    if (starts) {
      const activeIndex = pickActiveIndex(nowSec, starts, spanEnd);
      return { activeIndex, itemStartTimes: starts, spanStart, spanEnd };
    }
  }

  // Strategy 2: proportional or equal time-division
  const weights: number[] = opts.proportionalToLength !== false
    ? labels.map((l) => Math.max(1, l.length))
    : labels.map(() => 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const starts: number[] = [];
  let cursor = spanStart;
  for (let i = 0; i < n; i++) {
    starts.push(cursor);
    cursor += (weights[i] / totalWeight) * totalSpan;
  }

  const activeIndex = pickActiveIndex(nowSec, starts, spanEnd);
  return { activeIndex, itemStartTimes: starts, spanStart, spanEnd };
}

function pickActiveIndex(nowSec: number, starts: number[], spanEnd: number): number {
  if (nowSec < starts[0]) return -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (nowSec >= starts[i]) {
      // Last item stays active until spanEnd, then remains highlighted (post-active).
      if (i === starts.length - 1 && nowSec > spanEnd) return i;
      return i;
    }
  }
  return -1;
}

/**
 * For each phrase, find the time of its first significant word inside the
 * timing stream. Returns null if any phrase can't be matched (caller falls
 * back to proportional split).
 */
function matchPhraseStarts(phrases: string[], timings: WordTiming[]): number[] | null {
  const result: number[] = [];
  let searchFrom = 0;
  for (const phrase of phrases) {
    const firstWord = normalize(phrase.split(/\s+/)[0] ?? "");
    if (!firstWord) return null;
    let matched = -1;
    for (let i = searchFrom; i < timings.length; i++) {
      if (normalize(timings[i].word).startsWith(firstWord.slice(0, 4))) {
        matched = i;
        break;
      }
    }
    if (matched === -1) return null;
    result.push(timings[matched].start);
    searchFrom = matched + 1;
  }
  return result;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:"'()]/g, "");
}
