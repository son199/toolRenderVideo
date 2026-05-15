import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, resolveBadge, type SceneProps } from "./sceneProps";

/**
 * HERO scene — big centered headline, dramatic Ken Burns, particle-light.
 * Dùng cho hook (scene 0) hoặc câu chốt mạnh.
 */
export const HeroScene: React.FC<SceneProps> = ({ scene, template, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);
  const badge = resolveBadge(theme, template);

  const fallbackText: string =
    scene.text || scene.headline || scene.caption?.vi || "";
  const { timings } = useSceneTiming(scene, fallbackText);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="hero"
        theme={theme}
        accentColor={accent}
        backgroundImage={scene.background_image}
        backgroundVideo={scene.video_path}
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
        {badge && (
          <div
            style={{
              position: "absolute",
              top: "12%",
              background: badge.gradient,
              padding: "18px 45px",
              borderRadius: "60px",
              color: "white",
              fontWeight: 900,
              fontSize: "30px",
              letterSpacing: "0.25em",
              boxShadow: `0 15px 40px rgba(0,0,0,0.5), 0 0 24px ${accent}55`,
              textTransform: "uppercase",
              transform: `translateY(${spring({ frame, fps, config: { damping: 12 } }) * 20 - 20}px)`,
              opacity: spring({ frame, fps }),
            }}
          >
            {badge.text}
          </div>
        )}

        <WordReveal
          timings={timings}
          accentColor={accent}
          fontSize={110}
          fontWeight={900}
          variant="rise"
          gap="20px 28px"
          maxWidthPx={920}
          maxLines={4}
          minFontSize={48}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
