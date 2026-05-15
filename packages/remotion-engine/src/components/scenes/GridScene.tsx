import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { useSyncedHighlight } from "../shared/useSyncedHighlight";
import { resolveAccent, type SceneProps } from "./sceneProps";

interface GridItem {
  label: string;
  icon?: string;
}

/**
 * GRID scene — 2×2 / 2×3 / 3×3 cards. As the voice explains each cell, that
 * card scales up + glows; passed cards keep an accent border; future cards
 * stay dim. Voice doesn't have to mention cells in order — the active index
 * comes from time-division across `word_timings`.
 */
export const GridScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const cells: GridItem[] = resolveCells(scene);
  const headline: string = scene.headline || "";
  const headlineSpring = spring({ frame, fps, config: { damping: 14 } });

  const fallbackNarration = scene.caption?.vi || scene.text || cells.map((c) => c.label).join(", ");
  const { timings } = useSceneTiming(scene, fallbackNarration);
  const { activeIndex } = useSyncedHighlight(cells, timings, {
    proportionalToLength: true,
    itemPhrases: scene.item_phrases,
    introLeadSec: 0.2,
  });

  const cols = cells.length <= 4 ? 2 : cells.length <= 6 ? 2 : 3;
  const cellWidth = Math.floor((880 - 32 * (cols - 1)) / cols);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="grid"
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
          padding: "80px",
          gap: "60px",
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
              opacity: headlineSpring,
              transform: `translateY(${interpolate(headlineSpring, [0, 1], [-30, 0])}px)`,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              textShadow: "0 6px 24px rgba(0,0,0,0.8)",
              maxWidth: "880px",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {headline}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: "32px",
            width: "880px",
          }}
        >
          {cells.map((cell, i) => {
            const entranceDelay = 4 + i * 5;
            const entranceSpring = spring({
              frame: frame - entranceDelay,
              fps,
              config: { damping: 8, stiffness: 200, mass: 0.6 },
            });

            const isActive = i === activeIndex;
            const isFuture = activeIndex !== -1 && i > activeIndex;

            const pulse = isActive ? 1 + 0.05 * Math.sin(frame / 6) : 1;
            const targetScale = isActive ? 1.08 : isFuture ? 0.94 : 1;
            const scale = interpolate(entranceSpring, [0, 1], [0.6, targetScale]) * pulse;
            const opacity = isFuture ? 0.4 : entranceSpring;

            const borderColor = isActive ? accent : `${accent}55`;
            const borderWidth = isActive ? 4 : 2;
            const cardBg = isActive
              ? `linear-gradient(135deg, ${accent}33 0%, ${accent}11 100%)`
              : "rgba(255,255,255,0.05)";
            const cardShadow = isActive
              ? `0 0 60px ${accent}66, 0 16px 40px rgba(0,0,0,0.6), inset 0 0 50px ${accent}22`
              : `0 12px 30px rgba(0,0,0,0.5), inset 0 0 30px ${accent}11`;

            return (
              <div
                key={`${i}-${cell.label}`}
                style={{
                  background: cardBg,
                  border: `${borderWidth}px solid ${borderColor}`,
                  borderRadius: "24px",
                  padding: "32px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  minHeight: cols === 3 ? "200px" : "240px",
                  opacity,
                  transform: `scale(${scale})`,
                  boxShadow: cardShadow,
                  position: "relative",
                  transition: "border-color 0.1s ease-out",
                }}
              >
                {/* Active corner badge */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: accent,
                      color: "#050505",
                      fontWeight: 900,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 0 18px ${accent}`,
                    }}
                  >
                    ✓
                  </div>
                )}

                {cell.icon && (
                  <div
                    style={{
                      fontSize: cols === 3 ? "60px" : "84px",
                      lineHeight: 1,
                      color: isActive ? "#ffffff" : accent,
                      textShadow: isActive
                        ? `0 0 40px ${accent}, 0 0 16px ${accent}`
                        : `0 0 30px ${accent}`,
                    }}
                  >
                    {cell.icon}
                  </div>
                )}
                <div
                  style={{
                    fontSize: `${autoFitFontSize(cell.label, {
                      maxWidthPx: cellWidth - 40,
                      maxLines: 2,
                      basePx: cols === 3 ? 30 : 38,
                      minPx: 20,
                      uppercase: true,
                    })}px`,
                    fontWeight: 800,
                    color: isActive ? accent : "#ffffff",
                    textTransform: "uppercase",
                    textAlign: "center",
                    lineHeight: 1.2,
                    maxWidth: `${cellWidth - 40}px`,
                    textShadow: isActive
                      ? `0 0 22px ${accent}aa, 0 3px 12px rgba(0,0,0,0.9)`
                      : "0 3px 10px rgba(0,0,0,0.8)",
                  }}
                >
                  {cell.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const FALLBACK_ICONS = ["★", "✦", "⚡", "◆", "▲", "●", "✚", "✱", "◉"];

function resolveCells(scene: any): GridItem[] {
  if (Array.isArray(scene.cells) && scene.cells.length > 0) {
    return scene.cells
      .map((c: any, i: number) =>
        typeof c === "string"
          ? { label: c, icon: FALLBACK_ICONS[i % FALLBACK_ICONS.length] }
          : { label: String(c?.label ?? c?.text ?? ""), icon: c?.icon ?? FALLBACK_ICONS[i % FALLBACK_ICONS.length] },
      )
      .filter((c: GridItem) => c.label)
      .slice(0, 9);
  }
  if (Array.isArray(scene.items) && scene.items.length > 0) {
    return scene.items
      .map((c: any, i: number) => ({
        label: typeof c === "string" ? c : String(c?.text ?? ""),
        icon: FALLBACK_ICONS[i % FALLBACK_ICONS.length],
      }))
      .filter((c: GridItem) => c.label)
      .slice(0, 9);
  }
  const text: string = scene.text || "";
  const parts = text
    .split(/[,;•\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return parts.map((p, i) => ({ label: p, icon: FALLBACK_ICONS[i % FALLBACK_ICONS.length] }));
}
