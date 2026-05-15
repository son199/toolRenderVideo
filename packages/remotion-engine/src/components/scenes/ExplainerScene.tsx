import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { useSyncedHighlight } from "../shared/useSyncedHighlight";
import { resolveAccent, type SceneProps } from "./sceneProps";

interface ExplainerBullet {
  label: string;
  icon?: string;
}

/**
 * EXPLAINER scene — the workhorse for pro-viral content.
 *
 * Layout: bold title up top + 3-5 bullet cards below. As voice narrates, the
 * matching bullet pops out (scale + glow + check), previous bullets keep a
 * faded check, future bullets stay dim. Voice text doesn't need to mirror
 * bullet text — bullets summarize, voice elaborates. Viewer sees the structure.
 *
 * Pulls `scene.bullets: [{label, icon?}]` (preferred) or `scene.items` /
 * splits `scene.text`. `scene.title` / `scene.headline` drives the header.
 */
export const ExplainerScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const title: string = scene.title || scene.headline || scene.text || "";
  const bullets: ExplainerBullet[] = resolveBullets(scene);

  const fallbackNarration =
    scene.caption?.vi || scene.text || bullets.map((b) => b.label).join(". ");
  const { timings } = useSceneTiming(scene, fallbackNarration);
  const { activeIndex } = useSyncedHighlight(bullets, timings, {
    proportionalToLength: true,
    itemPhrases: scene.item_phrases,
    introLeadSec: 0.3,
  });

  const titleSpring = spring({ frame, fps, config: { damping: 10, stiffness: 180 } });
  const titleY = interpolate(titleSpring, [0, 1], [-40, 0]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="explainer"
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
          flexDirection: "column",
          padding: "100px 80px 80px",
          gap: "50px",
          alignItems: "center",
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: `${autoFitFontSize(title, {
                maxWidthPx: 880,
                maxLines: 2,
                basePx: 78,
                minPx: 42,
                uppercase: true,
              })}px`,
              fontWeight: 900,
              color: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              lineHeight: 1.1,
              textAlign: "center",
              maxWidth: "880px",
              opacity: titleSpring,
              transform: `translateY(${titleY}px)`,
              textShadow: `0 0 30px ${accent}55, 0 8px 24px rgba(0,0,0,0.9)`,
              borderBottom: `4px solid ${accent}`,
              paddingBottom: "20px",
            }}
          >
            {title}
          </div>
        )}

        {/* Bullets */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "26px",
            width: "100%",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {bullets.map((b, i) => {
            const entranceDelay = 8 + i * 7;
            const entranceSpring = spring({
              frame: frame - entranceDelay,
              fps,
              config: { damping: 8, stiffness: 200, mass: 0.6 },
            });

            const isActive = i === activeIndex;
            const isPast = activeIndex !== -1 && i < activeIndex;
            const isFuture = activeIndex !== -1 && i > activeIndex;

            const pulse = isActive ? 1 + 0.04 * Math.sin(frame / 5) : 1;
            const targetScale = isActive ? 1.05 : isFuture ? 0.96 : 1;
            const scale = interpolate(entranceSpring, [0, 1], [0.75, targetScale]) * pulse;
            const enterX = interpolate(entranceSpring, [0, 1], [-70, 0]);
            const opacity = isFuture ? 0.45 : entranceSpring;

            const cardBg = isActive
              ? `linear-gradient(90deg, ${accent}33 0%, ${accent}11 80%, transparent 100%)`
              : "rgba(255,255,255,0.04)";
            const cardBorder = isActive ? accent : `${accent}44`;
            const cardShadow = isActive
              ? `0 0 50px ${accent}55, 0 14px 30px rgba(0,0,0,0.6)`
              : "0 8px 20px rgba(0,0,0,0.5)";

            // Status icon
            let statusIcon: string;
            let statusBg: string;
            let statusColor: string;
            if (isActive) {
              statusIcon = "▶";
              statusBg = accent;
              statusColor = "#050505";
            } else if (isPast) {
              statusIcon = "✓";
              statusBg = `${accent}aa`;
              statusColor = "#050505";
            } else {
              statusIcon = String(i + 1);
              statusBg = "transparent";
              statusColor = accent;
            }

            return (
              <div
                key={`${i}-${b.label}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  padding: "22px 26px",
                  borderRadius: "20px",
                  background: cardBg,
                  border: `2px solid ${cardBorder}`,
                  boxShadow: cardShadow,
                  opacity,
                  transform: `translateX(${enterX}px) scale(${scale})`,
                  transformOrigin: "left center",
                  transition: "border-color 0.12s ease-out, background 0.12s ease-out",
                }}
              >
                <div
                  style={{
                    fontSize: "38px",
                    fontWeight: 900,
                    color: statusColor,
                    background: statusBg,
                    width: "68px",
                    height: "68px",
                    borderRadius: "16px",
                    border: `3px solid ${accent}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 30px ${accent}cc` : "none",
                  }}
                >
                  {statusIcon}
                </div>

                {b.icon && (
                  <div
                    style={{
                      fontSize: "48px",
                      color: isActive ? "#ffffff" : accent,
                      textShadow: isActive ? `0 0 24px ${accent}` : "none",
                      flexShrink: 0,
                    }}
                  >
                    {b.icon}
                  </div>
                )}

                <div
                  style={{
                    flex: 1,
                    fontSize: `${autoFitFontSize(b.label, {
                      maxWidthPx: 680,
                      maxLines: 2,
                      basePx: 42,
                      minPx: 24,
                      uppercase: false,
                    })}px`,
                    fontWeight: isActive ? 800 : 700,
                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.9)",
                    lineHeight: 1.2,
                    textShadow: isActive
                      ? `0 0 24px ${accent}88, 0 3px 12px rgba(0,0,0,0.9)`
                      : "0 3px 10px rgba(0,0,0,0.8)",
                    maxWidth: "680px",
                  }}
                >
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function resolveBullets(scene: any): ExplainerBullet[] {
  const fromBullets = arrayField(scene.bullets);
  if (fromBullets.length > 0) return fromBullets.slice(0, 5);
  const fromItems = arrayField(scene.items);
  if (fromItems.length > 0) return fromItems.slice(0, 5);
  const text: string = scene.text || "";
  const parts = text.split(/[;•\n]+/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 5).map((p) => ({ label: p }));
}

function arrayField(raw: unknown): ExplainerBullet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) =>
      typeof x === "string"
        ? { label: x }
        : { label: String(x?.label ?? x?.text ?? ""), icon: x?.icon },
    )
    .filter((b: ExplainerBullet) => b.label);
}
