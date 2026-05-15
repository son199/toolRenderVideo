import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitSingleWord } from "../shared/autoFit";
import { FONT_SANS } from "../shared/fonts";
import { HeroScene } from "./HeroScene";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, type SceneProps } from "./sceneProps";

const STRICT_NUMBER_RE = /^[+-]?\d{1,3}([.,]\d{1,3})?\s*[%+xKMB]?$/i;

/**
 * STAT scene — giant number, label below.
 *
 * Only renders if we can extract a CLEAN number (e.g. "60+", "20%", "1.5K").
 * Otherwise we fall back to HeroScene rather than blasting an arbitrary
 * 320px word onto the frame (which used to happen with text like
 * "9 Router hỗ trợ hơn 60 nhà cung cấp AI…").
 */
export const StatScene: React.FC<SceneProps> = ({ scene, template, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const number: string = pickCleanNumber(scene);
  const label: string =
    scene.label || stripNumber(scene.text, number) || scene.caption?.vi || scene.text || "";

  const numberSpring = spring({ frame, fps, config: { damping: 9, stiffness: 120, mass: 1.1 } });
  const numberScale = interpolate(numberSpring, [0, 1], [0.3, 1]);
  const numberOpacity = interpolate(numberSpring, [0, 1], [0, 1]);

  const { timings: labelTimings } = useSceneTiming(scene, label);

  // No clean number → don't fake a stat layout. Fall back to Hero.
  if (!number) {
    return <HeroScene scene={scene} template={template} theme={theme} />;
  }

  const numberFontSize = autoFitSingleWord(number, 880, 320, 140, 0.62);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="stat"
        theme={theme}
        accentColor={accent}
        backgroundImage={scene.background_image}
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
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: `${numberFontSize}px`,
            fontWeight: 900,
            color: accent,
            textShadow: `0 0 80px ${accent}cc, 0 0 24px ${accent}, 0 10px 30px rgba(0,0,0,0.8)`,
            transform: `scale(${numberScale})`,
            opacity: numberOpacity,
            lineHeight: 1,
            fontFamily: FONT_SANS,
            letterSpacing: "-0.04em",
            maxWidth: "880px",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {number}
        </div>

        <div style={{ marginTop: "60px", maxWidth: "85%" }}>
          <WordReveal
            timings={labelTimings}
            accentColor={accent}
            fontSize={56}
            fontWeight={700}
            variant="rise"
            gap="10px 16px"
            maxWidthPx={820}
            maxLines={3}
            minFontSize={30}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function pickCleanNumber(scene: any): string {
  // Explicit field first
  if (typeof scene.number === "string" && scene.number.trim()) {
    const n = scene.number.trim();
    if (STRICT_NUMBER_RE.test(n)) return n;
  }
  if (typeof scene.number === "number") return String(scene.number);

  // Extract a clean number-token from text — must match strict regex.
  const text: string = scene.text || scene.headline || scene.caption?.vi || "";
  const tokens = text.split(/\s+/);
  for (const tok of tokens) {
    const cleaned = tok.replace(/[.,!?;:"']+$/, "");
    if (STRICT_NUMBER_RE.test(cleaned)) return cleaned;
  }
  return "";
}

function stripNumber(text: string | undefined, number: string): string {
  if (!text || !number) return "";
  return text.replace(number, "").replace(/\s+/g, " ").trim();
}
