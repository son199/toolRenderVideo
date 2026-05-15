import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { autoFitFontSize } from "../shared/autoFit";
import { FONT_MONO } from "../shared/fonts";
import { SceneBackground } from "../shared/SceneBackground";
import { useSceneTiming } from "../shared/useSceneTiming";
import { WordReveal } from "../shared/WordReveal";
import { resolveAccent, type SceneProps } from "./sceneProps";

interface TerminalLine {
  prompt?: string;
  text: string;
  delay?: number;
}

/**
 * TERMINAL scene — mock CLI window typing out commands character-by-character.
 * Pulls `scene.lines: TerminalLine[]` (preferred) or parses `scene.command`
 * (string). Caption/text drives narration below.
 */
export const TerminalScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = resolveAccent(theme);

  const lines: TerminalLine[] = resolveLines(scene);
  const caption: string = scene.caption?.vi || scene.text || "";
  const { timings } = useSceneTiming(scene, caption);

  const windowSpring = spring({ frame, fps, config: { damping: 14 } });
  const windowScale = interpolate(windowSpring, [0, 1], [0.85, 1]);

  const cursorOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#050505" }}>
      <SceneBackground
        sceneType="terminal"
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
          gap: "50px",
        }}
      >
        {/* Mock terminal window */}
        <div
          style={{
            width: "92%",
            background: "#0d1117",
            borderRadius: "20px",
            border: `1px solid ${accent}44`,
            boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${accent}22`,
            overflow: "hidden",
            transform: `scale(${windowScale})`,
            opacity: windowSpring,
          }}
        >
          {/* Title bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 20px",
              background: "#161b22",
              borderBottom: "1px solid #30363d",
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff5f56" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#27c93f" }} />
            <div
              style={{
                marginLeft: 16,
                fontFamily: FONT_MONO,
                fontSize: 20,
                color: "#8b949e",
              }}
            >
              ~/project — bash
            </div>
          </div>

          {/* Lines */}
          <div
            style={{
              padding: "32px 36px",
              fontFamily: FONT_MONO,
              fontSize: "38px",
              lineHeight: 1.5,
              color: "#e6edf3",
              minHeight: "300px",
            }}
          >
            {lines.map((line, i) => {
              const lineDelay = line.delay ?? 12 + i * 18;
              const startFrame = lineDelay;
              if (frame < startFrame) return null;

              const charCount = line.text.length;
              const charsPerFrame = 0.6;
              const charsShown = Math.min(
                charCount,
                Math.floor((frame - startFrame) * charsPerFrame),
              );
              const isLastLine = i === lines.length - 1;
              const isTyping = charsShown < charCount;

              return (
                <div key={`${i}-${line.text}`} style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: accent, flexShrink: 0 }}>{line.prompt ?? "$"}</span>
                  <span>
                    {line.text.slice(0, charsShown)}
                    {isLastLine && isTyping && cursorOn && (
                      <span style={{ background: accent, color: "#0d1117", padding: "0 4px" }}>
                        &nbsp;
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Narration band */}
        {caption && (
          <div
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "28px",
              padding: "28px 44px",
              maxWidth: "92%",
            }}
          >
            <WordReveal
              timings={timings}
              accentColor={accent}
              fontSize={42}
              fontWeight={600}
              textTransform="none"
              variant="rise"
              gap="6px 12px"
              maxWidthPx={820}
              maxLines={2}
              minFontSize={26}
            />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function resolveLines(scene: any): TerminalLine[] {
  if (Array.isArray(scene.lines) && scene.lines.length > 0) {
    return scene.lines
      .map((l: any) =>
        typeof l === "string"
          ? { text: l }
          : { prompt: l?.prompt, text: String(l?.text ?? ""), delay: l?.delay },
      )
      .filter((l: TerminalLine) => l.text);
  }
  if (typeof scene.command === "string" && scene.command.trim()) {
    return [{ prompt: "$", text: scene.command.trim() }];
  }
  // Fallback — try to find a code-ish token in the text
  const text: string = scene.text || "";
  const m = /(?:npm|pip|yarn|pnpm|curl|git|docker|brew)\s+[^.!?]+/i.exec(text);
  if (m) return [{ prompt: "$", text: m[0].trim() }];
  return [{ prompt: "$", text: "echo \"hello world\"" }];
}
