import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { FONT_MONO } from "../shared/fonts";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, type SceneProps } from "./sceneProps";

/**
 * CTA scene — end card full-bleed với animated border, big call to action.
 * Pulls `scene.label` (CTA chính) + `scene.sub` (offer/deadline) + `scene.url`.
 */
export const CtaScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const label: string = scene.label || scene.text || scene.headline || "BẮT ĐẦU NGAY";
  const sub: string = scene.sub || scene.caption?.vi || "";
  const url: string = scene.url || "";

  const bigSpring = spring({ frame, fps, config: { damping: 9, stiffness: 110 } });
  const scale = interpolate(bigSpring, [0, 1], [0.4, 1]);

  const { timings } = useSceneTiming(scene, sub || label);

  // Pulsing border
  const pulse = 0.5 + 0.5 * Math.sin(frame / 8);
  const borderGlow = `0 0 ${20 + 30 * pulse}px ${accent}, inset 0 0 ${10 + 20 * pulse}px ${accent}55`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="cta"
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
          padding: "80px",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            opacity: bigSpring,
            padding: "60px 80px",
            borderRadius: "44px",
            border: `4px solid ${accent}`,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: borderGlow,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            maxWidth: "92%",
          }}
        >
          <div
            style={{
              fontSize: `${autoFitFontSize(label, {
                maxWidthPx: 780,
                maxLines: 3,
                basePx: 108,
                minPx: 48,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: "#ffffff",
              textShadow: `0 0 40px ${accent}, 0 8px 24px rgba(0,0,0,0.9)`,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              lineHeight: 1.05,
              textAlign: "center",
            }}
          >
            {label}
          </div>

          <div style={{ minHeight: "60px", width: "100%" }}>
            <WordReveal
              timings={timings}
              accentColor={accent}
              fontSize={40}
              fontWeight={500}
              variant="rise"
              textTransform="none"
              gap="8px 12px"
              maxWidthPx={780}
              maxLines={3}
              minFontSize={24}
            />
          </div>

          {url && (
            <div
              style={{
                marginTop: "12px",
                fontSize: "32px",
                fontWeight: 700,
                color: accent,
                fontFamily: FONT_MONO,
                letterSpacing: "0.06em",
                padding: "10px 20px",
                borderRadius: "12px",
                background: `${accent}11`,
                border: `1px solid ${accent}55`,
              }}
            >
              {url}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
