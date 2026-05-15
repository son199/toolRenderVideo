/**
 * Vietnamese-safe font loading via @remotion/google-fonts.
 *
 * Why: the headless Chromium that Remotion renders in does NOT have system
 * Inter/Fraunces installed. When CSS says `font-family: 'Inter'`, Chromium
 * falls back to its default sans-serif, which often has buggy combining-
 * diacritic glyphs for Vietnamese — you get "gâ`n giô´ng" with the marks
 * detached from the base letter.
 *
 * Solution: load fonts that explicitly ship Vietnamese subsets, and reference
 * the exact family names returned by their `loadFont()` helpers.
 *
 * - Be Vietnam Pro — sans, designed by Vietnamese type studio Be, full diacritics
 * - Lora — serif, has Vietnamese subset, used for quotes (replaces Fraunces)
 * - JetBrains Mono — monospace, used for terminal scene, has full Vietnamese
 *
 * Call `loadAllFonts()` once at Root level; family names exported below for
 * scene components to use in `fontFamily`.
 */

import { loadFont as loadBeVietnamPro } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";

let loaded = false;

export function loadAllFonts(): void {
  if (loaded) return;
  loaded = true;
  // Eager-load weights actually used in scenes. Heavy weights (900) for
  // headlines, mid (500-700) for body, italic for quote.
  loadBeVietnamPro("normal", { weights: ["400", "500", "700", "800", "900"], subsets: ["vietnamese", "latin"] });
  loadLora("normal", { weights: ["400", "500", "600", "700"], subsets: ["vietnamese", "latin"] });
  loadLora("italic", { weights: ["400", "500", "600"], subsets: ["vietnamese", "latin"] });
  loadJetBrainsMono("normal", { weights: ["400", "500", "700"], subsets: ["vietnamese", "latin"] });
}

// Exact family names — must match what loadFont() injects into <style> tags.
export const FONT_SANS = "'Be Vietnam Pro', sans-serif";
export const FONT_SERIF_ITALIC = "'Lora', Georgia, serif";
export const FONT_MONO = "'JetBrains Mono', 'Consolas', monospace";
