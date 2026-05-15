import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, type SceneProps } from "./sceneProps";

/**
 * PRODUCT scene — ảnh sản phẩm bên trái, tên + tagline bên phải.
 * Pulls `scene.name` / `scene.tagline` / `scene.background_image`.
 */
export const ProductScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const name: string = scene.name || scene.headline || scene.text || "";
  const tagline: string = scene.tagline || scene.caption?.vi || "";

  const imgUrl = scene.background_image
    ? scene.background_image.startsWith("http")
      ? scene.background_image
      : staticFile(scene.background_image)
    : null;

  const imgSpring = spring({ frame, fps, config: { damping: 14 } });
  const imgX = interpolate(imgSpring, [0, 1], [-120, 0]);
  const textSpring = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const textX = interpolate(textSpring, [0, 1], [120, 0]);

  const { timings } = useSceneTiming(scene, tagline || name);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="product"
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px",
          gap: "60px",
        }}
      >
        {/* Product image (top half) */}
        <div
          style={{
            width: "78%",
            aspectRatio: "16 / 9",
            borderRadius: "44px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.04)",
            border: `2px solid ${accent}66`,
            boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${accent}33`,
            transform: `translateX(${imgX}px)`,
            opacity: imgSpring,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {imgUrl ? (
            <Img
              src={imgUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: "200px",
                color: accent,
                textShadow: `0 0 60px ${accent}`,
                fontWeight: 900,
              }}
            >
              ✦
            </div>
          )}
        </div>

        {/* Name + tagline */}
        <div
          style={{
            textAlign: "center",
            transform: `translateX(${textX}px)`,
            opacity: textSpring,
            width: "90%",
          }}
        >
          <div
            style={{
              fontSize: `${autoFitFontSize(name, {
                maxWidthPx: 880,
                maxLines: 2,
                basePx: 88,
                minPx: 44,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: "#ffffff",
              textShadow: `0 8px 30px rgba(0,0,0,0.9), 0 0 40px ${accent}44`,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "30px",
              lineHeight: 1.1,
            }}
          >
            {name}
          </div>
          <WordReveal
            timings={timings}
            accentColor={accent}
            fontSize={44}
            fontWeight={500}
            variant="rise"
            textTransform="none"
            gap="8px 12px"
            maxWidthPx={880}
            maxLines={3}
            minFontSize={28}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
