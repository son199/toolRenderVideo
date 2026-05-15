import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { useSyncedHighlight } from "../shared/useSyncedHighlight";
import { resolveAccent, type SceneProps } from "./sceneProps";

interface TimelineStep {
  label: string;
  detail?: string;
}

/**
 * TIMELINE scene — vertical numbered timeline. As voice explains each step,
 * the progress line fills up to that step's dot, the active dot scales up
 * and pulses, and the text brightens. Past steps keep a check mark.
 */
export const TimelineScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const steps: TimelineStep[] = resolveSteps(scene);
  const headline: string = scene.headline || "";
  const headlineSpring = spring({ frame, fps, config: { damping: 14 } });

  const fallbackNarration =
    scene.caption?.vi || scene.text || steps.map((s) => s.label).join(". ");
  const { timings } = useSceneTiming(scene, fallbackNarration);
  const { activeIndex } = useSyncedHighlight(steps, timings, {
    proportionalToLength: true,
    itemPhrases: scene.item_phrases,
    introLeadSec: 0.2,
  });

  // Progress fill = activeIndex / (steps.length - 1), clamped
  const progressFraction = steps.length <= 1
    ? 0
    : Math.max(0, Math.min(1, (activeIndex + 0.5) / steps.length));
  const progressSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const fillPct = progressFraction * 100 * progressSpring;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="timeline"
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
                basePx: 60,
                minPx: 32,
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

        <div style={{ display: "flex", flexDirection: "column", width: "100%", position: "relative" }}>
          {/* Base vertical line */}
          <div
            style={{
              position: "absolute",
              left: 35,
              top: 40,
              bottom: 40,
              width: 4,
              background: `${accent}33`,
              borderRadius: 2,
            }}
          />
          {/* Progress fill line — grows as activeIndex advances */}
          <div
            style={{
              position: "absolute",
              left: 35,
              top: 40,
              height: `calc((100% - 80px) * ${fillPct / 100})`,
              width: 4,
              background: accent,
              borderRadius: 2,
              boxShadow: `0 0 20px ${accent}, 0 0 8px ${accent}cc`,
            }}
          />
          {steps.map((step, i) => {
            const entranceDelay = 6 + i * 6;
            const entranceSpring = spring({
              frame: frame - entranceDelay,
              fps,
              config: { damping: 8, stiffness: 200, mass: 0.6 },
            });

            const isActive = i === activeIndex;
            const isPast = activeIndex !== -1 && i < activeIndex;
            const isFuture = activeIndex !== -1 && i > activeIndex;

            const pulse = isActive ? 1 + 0.05 * Math.sin(frame / 5) : 1;
            const targetScale = isActive ? 1.05 : isFuture ? 0.96 : 1;
            const scale = interpolate(entranceSpring, [0, 1], [0.7, targetScale]) * pulse;
            const opacity = isFuture ? 0.45 : entranceSpring;

            const dotBg = isActive || isPast ? accent : "transparent";
            const dotColor = isActive || isPast ? "#050505" : accent;
            const dotShadow = isActive
              ? `0 0 40px ${accent}, 0 0 14px ${accent}`
              : isPast
              ? `0 0 16px ${accent}cc`
              : "none";
            const dotContent = isPast ? "✓" : i + 1;

            return (
              <div
                key={`${i}-${step.label}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "32px",
                  marginBottom: "44px",
                  opacity,
                  transform: `translateX(${interpolate(entranceSpring, [0, 1], [-60, 0])}px) scale(${scale})`,
                  transformOrigin: "left center",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: 900,
                    color: dotColor,
                    background: dotBg,
                    width: "74px",
                    height: "74px",
                    borderRadius: "50%",
                    border: `4px solid ${accent}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: dotShadow,
                    flexShrink: 0,
                    transition: "background 0.12s ease-out, color 0.12s ease-out",
                  }}
                >
                  {dotContent}
                </div>
                <div style={{ flex: 1, paddingTop: 6 }}>
                  <div
                    style={{
                      fontSize: `${autoFitFontSize(step.label, {
                        maxWidthPx: 720,
                        maxLines: 2,
                        basePx: 46,
                        minPx: 26,
                        uppercase: true,
                      })}px`,
                      fontWeight: 800,
                      color: isActive ? accent : "#ffffff",
                      textTransform: "uppercase",
                      lineHeight: 1.15,
                      textShadow: isActive
                        ? `0 0 26px ${accent}99, 0 4px 14px rgba(0,0,0,0.8)`
                        : "0 4px 14px rgba(0,0,0,0.8)",
                      maxWidth: "720px",
                    }}
                  >
                    {step.label}
                  </div>
                  {step.detail && (
                    <div
                      style={{
                        fontSize: `${autoFitFontSize(step.detail, {
                          maxWidthPx: 720,
                          maxLines: 2,
                          basePx: 30,
                          minPx: 22,
                          uppercase: false,
                        })}px`,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.75)",
                        marginTop: 8,
                        lineHeight: 1.3,
                        maxWidth: "720px",
                      }}
                    >
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function resolveSteps(scene: any): TimelineStep[] {
  if (Array.isArray(scene.steps) && scene.steps.length > 0) {
    return scene.steps
      .map((s: any) =>
        typeof s === "string" ? { label: s } : { label: String(s?.label ?? s?.text ?? ""), detail: s?.detail },
      )
      .filter((s: TimelineStep) => s.label);
  }
  if (Array.isArray(scene.items) && scene.items.length > 0) {
    return scene.items
      .map((s: any) => (typeof s === "string" ? { label: s } : { label: String(s?.text ?? "") }))
      .filter((s: TimelineStep) => s.label);
  }
  const text: string = scene.text || "";
  const parts = text.split(/(?:\n+|;\s*|→)/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 4).map((p) => ({ label: p }));
}
