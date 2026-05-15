import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { FONT_SANS, FONT_SERIF_ITALIC } from "../shared/fonts";
import { SceneBackground } from "../shared/SceneBackground";
import { resolveAccent, type SceneProps } from "./sceneProps";

/**
 * QUOTE scene — static dramatic layout, NO karaoke.
 *
 * Word-by-word reveal on a serif quote feels off (the rhythm fights the
 * italic flow). We render the body all at once with a slow fade-in + slight
 * scale, the giant quotation mark animates in first, and attribution slides
 * up from below. Each element uses font weights tuned for Lora (which has a
 * proper Vietnamese subset, unlike Fraunces which decomposes diacritics).
 *
 * Pulls `scene.quote` / `scene.text` / `scene.caption.vi`, attribution from
 * `scene.attribution` / `scene.author`.
 */
export const QuoteScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const body: string =
    scene.quote || scene.text || scene.caption?.vi || scene.headline || "";
  const attribution: string = scene.attribution || scene.author || "";

  const markSpring = spring({ frame, fps, config: { damping: 14 } });
  const markScale = interpolate(markSpring, [0, 1], [0.4, 1]);
  const markY = interpolate(markSpring, [0, 1], [-30, 0]);

  const bodySpring = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 90 } });
  const bodyScale = interpolate(bodySpring, [0, 1], [0.94, 1]);
  const bodyY = interpolate(bodySpring, [0, 1], [20, 0]);

  const attrSpring = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const attrY = interpolate(attrSpring, [0, 1], [30, 0]);

  // Subtle ambient pulse on the accent underline
  const pulse = 0.7 + 0.3 * Math.sin(frame / 18);

  const bodyFontSize = autoFitFontSize(body, {
    maxWidthPx: 880,
    maxLines: 6,
    basePx: 76,
    minPx: 38,
    uppercase: false,
    avgCharWidthRatio: 0.46, // italic serif runs narrower
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0a0a0a" }}>
      <SceneBackground
        sceneType="quote"
        theme={theme}
        accentColor={accent}
        backgroundImage={null}
        backgroundVideo={null}
        audioSrc={scene.audio_path}
        durationSec={scene.duration_sec}
        sceneId={scene.id}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          padding: "100px 80px",
        }}
      >
        {/* Giant accent quotation mark */}
        <div
          style={{
            fontFamily: FONT_SERIF_ITALIC,
            fontSize: "240px",
            color: accent,
            opacity: 0.55 * markSpring,
            lineHeight: 0.6,
            transform: `scale(${markScale}) translateY(${markY}px)`,
            marginBottom: "-10px",
            textShadow: `0 0 50px ${accent}88`,
          }}
        >
          “
        </div>

        {/* Quote body — static, no karaoke */}
        <div
          style={{
            fontFamily: FONT_SERIF_ITALIC,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: `${bodyFontSize}px`,
            color: "#ffffff",
            lineHeight: 1.32,
            textAlign: "center",
            maxWidth: "880px",
            opacity: bodySpring,
            transform: `scale(${bodyScale}) translateY(${bodyY}px)`,
            textShadow: "0 6px 22px rgba(0,0,0,0.85)",
          }}
        >
          {body}
        </div>

        {/* Animated underline accent */}
        <div
          style={{
            marginTop: "40px",
            width: 140 * bodySpring,
            height: 4,
            background: accent,
            borderRadius: 2,
            opacity: pulse,
            boxShadow: `0 0 18px ${accent}cc`,
          }}
        />

        {/* Attribution */}
        {attribution && (
          <div
            style={{
              marginTop: "32px",
              fontFamily: FONT_SANS,
              fontSize: "34px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: attrSpring,
              transform: `translateY(${attrY}px)`,
            }}
          >
            — {attribution}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
