import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { HeroScene } from "./HeroScene";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, type SceneProps } from "./sceneProps";

/**
 * COMPARISON scene — split-screen 2 cột (TRƯỚC / SAU, A / B, CŨ / MỚI).
 * Pulls `scene.left` / `scene.right`, fallback parse từ `scene.text`.
 */
export const ComparisonScene: React.FC<SceneProps> = ({ scene, template, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const parsed = parseLeftRight(scene);
  const left = parsed?.left ?? "";
  const right = parsed?.right ?? "";

  const slideIn = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const leftX = interpolate(slideIn, [0, 1], [-200, 0]);
  const rightX = interpolate(slideIn, [0, 1], [200, 0]);
  const dividerScale = interpolate(slideIn, [0, 1], [0, 1]);

  const fallbackNarration = scene.caption?.vi || `${left} so với ${right}`;
  const { timings } = useSceneTiming(scene, fallbackNarration);

  // No genuine left/right pair → don't fake a split. Fall back to Hero layout
  // so the narration is shown cleanly instead of two arbitrary half-sentences.
  if (!parsed) {
    return <HeroScene scene={scene} template={template} theme={theme} />;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="comparison"
        theme={theme}
        accentColor={accent}
        backgroundImage={null}
        backgroundVideo={null}
        audioSrc={scene.audio_path}
        durationSec={scene.duration_sec}
        sceneId={scene.id}
      />

      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        {/* LEFT */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px",
            transform: `translateX(${leftX}px)`,
            opacity: slideIn,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
            borderRight: `4px solid ${accent}66`,
          }}
        >
          <div
            style={{
              fontSize: `${autoFitFontSize(left, {
                maxWidthPx: 460,
                maxLines: 4,
                basePx: 76,
                minPx: 32,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              textTransform: "uppercase",
              textShadow: "0 6px 24px rgba(0,0,0,0.8)",
              lineHeight: 1.1,
              maxWidth: "460px",
            }}
          >
            {left}
          </div>
        </div>

        {/* DIVIDER ARROW */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${dividerScale})`,
            fontSize: "120px",
            color: accent,
            textShadow: `0 0 40px ${accent}, 0 0 12px ${accent}cc`,
            zIndex: 30,
          }}
        >
          →
        </div>

        {/* RIGHT */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px",
            transform: `translateX(${rightX}px)`,
            opacity: slideIn,
            background: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)`,
            borderLeft: `4px solid ${accent}aa`,
          }}
        >
          <div
            style={{
              fontSize: `${autoFitFontSize(right, {
                maxWidthPx: 460,
                maxLines: 4,
                basePx: 84,
                minPx: 32,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: accent,
              textAlign: "center",
              textTransform: "uppercase",
              textShadow: `0 0 30px ${accent}cc, 0 6px 24px rgba(0,0,0,0.8)`,
              lineHeight: 1.1,
              maxWidth: "460px",
            }}
          >
            {right}
          </div>
        </div>
      </AbsoluteFill>

      {/* Narration overlay (sub-band ở dưới) */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 80px 100px 80px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "40px",
            padding: "32px 56px",
            maxWidth: "90%",
          }}
        >
          <WordReveal
            timings={timings}
            accentColor={accent}
            fontSize={44}
            fontWeight={700}
            variant="rise"
            gap="8px 12px"
            textTransform="none"
            maxWidthPx={820}
            maxLines={3}
            minFontSize={26}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function parseLeftRight(scene: any): { left: string; right: string } | null {
  if (scene.left && scene.right) return { left: String(scene.left), right: String(scene.right) };
  const text: string = scene.text || scene.headline || "";
  // Try splitters: " // ", " vs ", " → ", " / ", " so với ", " thay vì "
  for (const sep of [" // ", " vs ", " → ", " / ", " so với ", " thay vì ", " vs. "]) {
    if (text.toLowerCase().includes(sep.toLowerCase())) {
      const idx = text.toLowerCase().indexOf(sep.toLowerCase());
      const l = text.slice(0, idx).trim();
      const r = text.slice(idx + sep.length).trim();
      if (l && r) return { left: l, right: r };
    }
  }
  // No real comparison pair detected — caller should fall back to a non-split layout.
  return null;
}
