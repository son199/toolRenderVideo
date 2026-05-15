import React from "react";
import { AbsoluteFill, Audio, Img, Video, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Particles } from "../Particles";
import { Waveform } from "../Waveform";
import { SCENE_TYPE_CONFIG, type SceneType } from "../scenes/types";
import { ProceduralBg, pickProceduralVariant } from "./ProceduralBg";

export type ThemeName = "danger" | "warning" | "default" | "success";

export interface SceneBackgroundProps {
  sceneType: SceneType;
  theme: ThemeName;
  accentColor: string;
  backgroundImage?: string | null;
  backgroundVideo?: string | null;
  audioSrc?: string | null;
  durationSec: number;
  /** Used as seed so neighbouring scenes pick different procedural variants. */
  sceneId?: number | string;
}

/**
 * Scene-types that should keep using stock video / image background (cinematic
 * impact for hooks and CTAs). Everything else gets a procedural CSS background
 * so the video doesn't feel like the same particle loop over and over.
 */
const STOCK_BG_TYPES: ReadonlySet<string> = new Set(["hero", "cta"]);

const THEME_GRADIENT: Record<ThemeName, string> = {
  success: "linear-gradient(135deg, #001510 0%, #004d40 50%, #001510 100%)",
  danger: "linear-gradient(135deg, #1a0000 0%, #7f0000 50%, #1a0000 100%)",
  warning: "linear-gradient(135deg, #1a1000 0%, #ff8f00 50%, #1a1000 100%)",
  default: "linear-gradient(135deg, #050505 0%, #1a1a1a 50%, #050505 100%)",
};

/**
 * Background factory cho mọi scene-type. Tự đọc `SCENE_TYPE_CONFIG[sceneType]`
 * để chọn: cường độ Ken Burns, particle count + speed, waveform position,
 * vignette opacity, có ảnh nền hay không.
 *
 * Mỗi scene-type vì thế cho ra background trông KHÁC nhau dù dùng cùng helper.
 */
export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  sceneType,
  theme,
  accentColor,
  backgroundImage,
  backgroundVideo,
  audioSrc,
  durationSec,
  sceneId,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = SCENE_TYPE_CONFIG[sceneType] ?? SCENE_TYPE_CONFIG.kinetic;

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const scale = interpolate(frame, [0, totalFrames], [1, cfg.kenBurnsIntensity], {
    extrapolateRight: "clamp",
  });
  const vignetteOpacity = interpolate(frame, [0, 15], [0, cfg.vignetteOpacity], {
    extrapolateRight: "clamp",
  });

  const useProcedural = !STOCK_BG_TYPES.has(sceneType);
  const proceduralVariant = useProcedural
    ? pickProceduralVariant(sceneType, sceneId ?? 0)
    : null;

  const showImage = !useProcedural && cfg.hasBackgroundImage && !!backgroundImage;
  const imgSrc = backgroundImage
    ? backgroundImage.startsWith("http")
      ? backgroundImage
      : staticFile(backgroundImage)
    : null;
  const videoSrc = backgroundVideo
    ? backgroundVideo.startsWith("http")
      ? backgroundVideo
      : staticFile(backgroundVideo)
    : null;
  const audioUrl = audioSrc
    ? audioSrc.startsWith("http")
      ? audioSrc
      : staticFile(audioSrc)
    : null;

  return (
    <>
      {/* Audio mounted at the scene root */}
      {audioUrl && (
        <AbsoluteFill>
          <Audio src={audioUrl} />
        </AbsoluteFill>
      )}

      {/* Base gradient */}
      <AbsoluteFill
        style={{
          background: THEME_GRADIENT[theme],
          filter: "contrast(1.2)",
          zIndex: -1,
        }}
      />

      {/* Procedural CSS background — used for explainer/list/grid/timeline/etc.
          so neighbouring scenes don't all look like the same particle loop. */}
      {useProcedural && proceduralVariant && (
        <ProceduralBg variant={proceduralVariant} accentColor={accentColor} />
      )}

      {/* Background image (per-type) */}
      {showImage && imgSrc && (
        <Img
          src={imgSrc}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: "brightness(0.35) contrast(1.1)",
            zIndex: 0,
          }}
        />
      )}

      {/* Background video (only for stock-bg types — hero/cta) */}
      {!useProcedural && videoSrc && (
        <Video
          crossOrigin="anonymous"
          src={videoSrc}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: "brightness(0.3) contrast(1.2) saturate(1.1)",
            opacity: 1,
            zIndex: 1,
          }}
        />
      )}

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle, transparent 20%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
          boxShadow: "inset 0 0 150px rgba(0,0,0,0.8)",
          zIndex: 2,
        }}
      />

      {/* Particles (count/speed per type) */}
      {cfg.particleCount > 0 && (
        <Particles count={cfg.particleCount} speed={cfg.particleSpeed} />
      )}

      {/* Waveform (only when type config asks for it) */}
      {cfg.showWaveform && audioUrl && (
        <Waveform audioSrc={audioUrl} color={accentColor} position={cfg.waveformPosition} />
      )}
    </>
  );
};
