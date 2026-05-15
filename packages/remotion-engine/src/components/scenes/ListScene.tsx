import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { useSyncedHighlight } from "../shared/useSyncedHighlight";
import { resolveAccent, type SceneProps } from "./sceneProps";

/**
 * LIST scene — vertical bullets that highlight in sync with the voice.
 *
 * The currently-spoken item pops out (scale + glow + check icon), past items
 * keep a faded check, future items stay dim. Even when the LLM doesn't supply
 * `item_phrases`, the hook divides voice time across items proportional to
 * their text length so the viewer can follow along.
 */
export const ListScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const items: string[] = resolveItems(scene);
  const headline: string = scene.headline || scene.text || "";

  const fallbackNarration = scene.caption?.vi || scene.text || items.join(". ");
  const { timings } = useSceneTiming(scene, fallbackNarration);
  const { activeIndex } = useSyncedHighlight(items, timings, {
    proportionalToLength: true,
    itemPhrases: scene.item_phrases,
    introLeadSec: 0.2,
  });

  const headlineSpring = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="list"
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
          alignItems: "flex-start",
          flexDirection: "column",
          padding: "80px 100px",
        }}
      >
        {headline && (
          <div
            style={{
              fontSize: `${autoFitFontSize(headline, {
                maxWidthPx: 880,
                maxLines: 2,
                basePx: 64,
                minPx: 36,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "50px",
              opacity: headlineSpring,
              transform: `translateX(${interpolate(headlineSpring, [0, 1], [-60, 0])}px)`,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              textShadow: "0 6px 24px rgba(0,0,0,0.8)",
              maxWidth: "880px",
            }}
          >
            {headline}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
          {items.map((item, i) => {
            // Entrance: pro-viral bounce
            const entranceDelay = 6 + i * 8;
            const entranceSpring = spring({
              frame: frame - entranceDelay,
              fps,
              config: { damping: 8, stiffness: 200, mass: 0.6 },
            });

            const isActive = i === activeIndex;
            const hasPassed = i < activeIndex || (activeIndex === -1 ? false : i <= activeIndex);
            const isFuture = activeIndex !== -1 && i > activeIndex;

            // Highlight pulse — scale + glow when active
            const activePulse = isActive ? 1 + 0.04 * Math.sin(frame / 6) : 1;
            const targetScale = isActive ? 1.06 : isFuture ? 0.96 : 1;
            const scale = interpolate(entranceSpring, [0, 1], [0.7, targetScale]) * activePulse;
            const enterX = interpolate(entranceSpring, [0, 1], [-80, 0]);

            // Per-state styling
            const opacity = isFuture ? 0.45 : entranceSpring;
            const numberBg = isActive
              ? accent
              : hasPassed
              ? `${accent}88`
              : "transparent";
            const numberColor = isActive ? "#050505" : hasPassed ? "#050505" : accent;
            const labelColor = isActive ? accent : "#ffffff";
            const checkShown = i <= activeIndex && activeIndex !== -1;

            return (
              <div
                key={`${i}-${item}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "26px",
                  opacity,
                  transform: `translateX(${enterX}px) scale(${scale})`,
                  transformOrigin: "left center",
                  background: isActive
                    ? `linear-gradient(90deg, ${accent}22 0%, transparent 90%)`
                    : "transparent",
                  borderLeft: isActive ? `5px solid ${accent}` : "5px solid transparent",
                  paddingLeft: "20px",
                  borderRadius: "12px",
                  transition: "all 0.12s ease-out",
                }}
              >
                <div
                  style={{
                    fontSize: "44px",
                    fontWeight: 900,
                    color: numberColor,
                    background: numberBg,
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    border: `4px solid ${accent}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: isActive
                      ? `0 0 40px ${accent}, 0 0 18px ${accent}cc`
                      : `0 0 12px ${accent}44`,
                    flexShrink: 0,
                  }}
                >
                  {checkShown ? "✓" : i + 1}
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: `${autoFitFontSize(item, {
                      maxWidthPx: 720,
                      maxLines: 2,
                      basePx: 50,
                      minPx: 28,
                      uppercase: false,
                    })}px`,
                    fontWeight: isActive ? 800 : 700,
                    color: labelColor,
                    lineHeight: 1.2,
                    textShadow: isActive
                      ? `0 0 30px ${accent}88, 0 4px 16px rgba(0,0,0,0.9)`
                      : "0 4px 16px rgba(0,0,0,0.8)",
                    maxWidth: "720px",
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function resolveItems(scene: any): string[] {
  if (Array.isArray(scene.items) && scene.items.length > 0) {
    return scene.items.map((x: any) => (typeof x === "string" ? x : x?.text || "")).filter(Boolean);
  }
  const text: string = scene.text || scene.caption?.vi || "";
  if (text.includes("\n")) return text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (text.includes("; ")) return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  // Fallback: split by comma
  return text.split(/[,•]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
}
