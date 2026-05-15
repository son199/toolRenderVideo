import { useMemo } from "react";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

/**
 * Resolve per-word timings cho một scene.
 *
 * - Production path: dùng `scene.word_timings` từ TTS (Edge native) hoặc
 *   Whisper alignment (fallback ở backend `jobs.py`).
 * - Preview-only fallback: nếu cả hai đều thiếu, chia đều `duration_sec` cho
 *   số từ trong `fallbackText`. KHÔNG khớp voice — chỉ dùng để xem trước layout.
 *
 * `isFake=true` nghĩa là animation sẽ không khớp với audio thật.
 */
export function useSceneTiming(
  scene: { word_timings?: WordTiming[]; duration_sec: number },
  fallbackText: string,
): { timings: WordTiming[]; isFake: boolean } {
  return useMemo(() => {
    if (scene.word_timings && scene.word_timings.length > 0) {
      return { timings: scene.word_timings, isFake: false };
    }

    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[useSceneTiming] scene.word_timings missing — linear fallback. " +
        "Animation will NOT match voice. Check backend TTS / Whisper alignment.",
      );
    }
    const words = (fallbackText || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return { timings: [], isFake: true };
    }
    const per = scene.duration_sec / words.length;
    const timings = words.map((word, i) => ({
      word,
      start: per * i,
      end: per * (i + 1),
    }));
    return { timings, isFake: true };
  }, [scene.word_timings, scene.duration_sec, fallbackText]);
}
