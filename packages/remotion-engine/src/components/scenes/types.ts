// Vocabulary cho scene types — dùng chung giữa SceneRouter (TS) và LLM prompt (Python mirror ở apps/backend/app/services/scene_types.py).
// Mỗi type có config riêng để background, motion, accent khác nhau → không còn "1000 cái như 1".

export const SCENE_TYPES = [
  "hero",
  "stat",
  "quote",
  "comparison",
  "list",
  "product",
  "cta",
  "terminal",
  "timeline",
  "grid",
  "explainer",
  "kinetic",
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];

export interface SceneTypeConfig {
  particleCount: number;
  particleSpeed: number;
  kenBurnsIntensity: number;
  showWaveform: boolean;
  waveformPosition: "top" | "bottom" | "none";
  hasBackgroundImage: boolean;
  badgePosition: "top" | "bottom" | "none";
  accentMode: "glow" | "underline" | "box" | "none";
  vignetteOpacity: number;
}

export const SCENE_TYPE_CONFIG: Record<SceneType, SceneTypeConfig> = {
  hero: {
    particleCount: 20,
    particleSpeed: 0.6,
    kenBurnsIntensity: 1.35,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: true,
    badgePosition: "top",
    accentMode: "glow",
    vignetteOpacity: 0.8,
  },
  stat: {
    particleCount: 90,
    particleSpeed: 1.6,
    kenBurnsIntensity: 1.08,
    showWaveform: true,
    waveformPosition: "bottom",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "glow",
    vignetteOpacity: 0.5,
  },
  quote: {
    particleCount: 10,
    particleSpeed: 0.3,
    kenBurnsIntensity: 1.05,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "none",
    accentMode: "underline",
    vignetteOpacity: 0.4,
  },
  comparison: {
    particleCount: 40,
    particleSpeed: 1.0,
    kenBurnsIntensity: 1.10,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "box",
    vignetteOpacity: 0.6,
  },
  list: {
    particleCount: 25,
    particleSpeed: 0.8,
    kenBurnsIntensity: 1.05,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: true,
    badgePosition: "top",
    accentMode: "underline",
    vignetteOpacity: 0.55,
  },
  product: {
    particleCount: 30,
    particleSpeed: 0.9,
    kenBurnsIntensity: 1.12,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: true,
    badgePosition: "bottom",
    accentMode: "box",
    vignetteOpacity: 0.5,
  },
  cta: {
    particleCount: 70,
    particleSpeed: 1.4,
    kenBurnsIntensity: 1.20,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "glow",
    vignetteOpacity: 0.7,
  },
  terminal: {
    particleCount: 20,
    particleSpeed: 0.5,
    kenBurnsIntensity: 1.04,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "box",
    vignetteOpacity: 0.55,
  },
  timeline: {
    particleCount: 25,
    particleSpeed: 0.7,
    kenBurnsIntensity: 1.05,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "underline",
    vignetteOpacity: 0.5,
  },
  grid: {
    particleCount: 35,
    particleSpeed: 0.9,
    kenBurnsIntensity: 1.05,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "box",
    vignetteOpacity: 0.55,
  },
  explainer: {
    particleCount: 20,
    particleSpeed: 0.6,
    kenBurnsIntensity: 1.03,
    showWaveform: false,
    waveformPosition: "none",
    hasBackgroundImage: false,
    badgePosition: "top",
    accentMode: "underline",
    vignetteOpacity: 0.5,
  },
  kinetic: {
    particleCount: 60,
    particleSpeed: 1.2,
    kenBurnsIntensity: 1.25,
    showWaveform: true,
    waveformPosition: "bottom",
    hasBackgroundImage: true,
    badgePosition: "top",
    accentMode: "glow",
    vignetteOpacity: 0.7,
  },
};

export function resolveSceneType(raw: unknown): SceneType {
  if (typeof raw === "string" && (SCENE_TYPES as readonly string[]).includes(raw)) {
    return raw as SceneType;
  }
  return "kinetic";
}
