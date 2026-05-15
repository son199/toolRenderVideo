import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "./autoFit";
import { FONT_SANS } from "./fonts";
import type { WordTiming } from "./useSceneTiming";

export interface WordRevealProps {
  timings: WordTiming[];
  accentColor: string;
  // Layout styling
  fontSize?: number;
  fontWeight?: number | "normal";
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  textTransform?: "uppercase" | "none";
  textAlign?: "center" | "left" | "right";
  lineHeight?: number;
  // Container layout — when set, fontSize auto-shrinks so text fits within
  // maxWidthPx over at most maxLines lines. When omitted, fontSize is used as-is.
  maxWidthPx?: number;
  maxLines?: number;
  minFontSize?: number;
  flexDirection?: "row" | "column";
  gap?: string;
  // Per-word entrance variant
  variant?: "scale" | "rise" | "drop" | "blur";
}

/**
 * Word-by-word reveal đồng bộ với voice. Mỗi từ pop-up đúng lúc voice phát âm.
 * `timings` thường lấy từ `useSceneTiming(scene, fallbackText)`.
 */
export const WordReveal: React.FC<WordRevealProps> = ({
  timings,
  accentColor,
  fontSize = 82,
  fontWeight = 900,
  fontFamily = FONT_SANS,
  fontStyle = "normal",
  textTransform = "uppercase",
  textAlign = "center",
  lineHeight = 1.1,
  maxWidthPx,
  maxLines = 3,
  minFontSize = 32,
  flexDirection = "row",
  gap = "18px 24px",
  variant = "scale",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Auto-fit when maxWidthPx is provided: shrink fontSize so the full text fits
  // within maxWidthPx over at most maxLines lines.
  const fullText = timings.map((t) => t.word).join(" ");
  const effectiveFontSize = maxWidthPx
    ? autoFitFontSize(fullText, {
        maxWidthPx,
        maxLines,
        basePx: fontSize,
        minPx: minFontSize,
        maxPx: fontSize,
        uppercase: textTransform === "uppercase",
      })
    : fontSize;

  return (
    <div
      style={{
        display: "flex",
        flexDirection,
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap,
        textAlign,
        width: "100%",
        maxWidth: maxWidthPx ? `${maxWidthPx}px` : undefined,
      }}
    >
      {timings.map((t, i) => {
        const startFrame = Math.round(t.start * fps);
        const endFrame = Math.round(t.end * fps);
        if (frame < startFrame) return null;

        const isActive = frame >= startFrame && frame <= endFrame + fps * 0.5;
        const hasSpoken = frame > endFrame;

        const wordSpring = spring({
          frame: frame - startFrame,
          fps,
          config: { damping: 12, stiffness: 180, mass: 0.8 },
        });

        let transform = "";
        let filter = isActive ? "brightness(1.2)" : "none";
        if (variant === "scale") {
          const s = interpolate(wordSpring, [0, 1], [0.5, 1]);
          const y = interpolate(wordSpring, [0, 1], [30, 0]);
          transform = `scale(${s}) translateY(${y}px)`;
        } else if (variant === "rise") {
          const y = interpolate(wordSpring, [0, 1], [60, 0]);
          transform = `translateY(${y}px)`;
        } else if (variant === "drop") {
          const y = interpolate(wordSpring, [0, 1], [-60, 0]);
          transform = `translateY(${y}px)`;
        } else if (variant === "blur") {
          const b = interpolate(wordSpring, [0, 1], [12, 0]);
          filter = `blur(${b}px) ${isActive ? "brightness(1.2)" : ""}`;
        }

        return (
          <span
            key={`${i}-${t.word}`}
            style={{
              fontSize: `${effectiveFontSize}px`,
              fontWeight,
              fontFamily,
              fontStyle,
              color: isActive ? accentColor : "#ffffff",
              transform,
              textShadow: isActive
                ? `0 0 50px ${accentColor}cc, 0 0 15px ${accentColor}`
                : "0 6px 20px rgba(0,0,0,0.95)",
              opacity: isActive ? 1 : hasSpoken ? 0.7 : 0,
              display: "inline-block",
              lineHeight,
              textTransform,
              filter,
            }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
};
