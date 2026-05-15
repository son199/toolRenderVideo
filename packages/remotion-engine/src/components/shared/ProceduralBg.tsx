import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Procedural backgrounds — CSS-driven, no stock video, no asset download.
 * Each variant generates a visually distinct frame, so cycling them across
 * scenes kills the "every scene looks the same" feeling.
 *
 * Pick one per scene with `pickProceduralVariant(sceneType, theme, sceneId)`.
 */

export type BgVariant =
  | "mesh"
  | "blueprint"
  | "scanlines"
  | "neonRays"
  | "hologram"
  | "bokeh"
  | "circuit"
  | "waveform";

export interface ProceduralBgProps {
  variant: BgVariant;
  accentColor: string;
}

export const ProceduralBg: React.FC<ProceduralBgProps> = ({ variant, accentColor }) => {
  switch (variant) {
    case "mesh":
      return <MeshGradient accentColor={accentColor} />;
    case "blueprint":
      return <BlueprintGrid accentColor={accentColor} />;
    case "scanlines":
      return <ScanLines accentColor={accentColor} />;
    case "neonRays":
      return <NeonRays accentColor={accentColor} />;
    case "hologram":
      return <Hologram accentColor={accentColor} />;
    case "bokeh":
      return <Bokeh accentColor={accentColor} />;
    case "circuit":
      return <Circuit accentColor={accentColor} />;
    case "waveform":
      return <WavePattern accentColor={accentColor} />;
    default:
      return <MeshGradient accentColor={accentColor} />;
  }
};

/**
 * Deterministic variant picker. Same (sceneType, theme, sceneId) → same variant
 * across renders, but neighbouring scenes get different ones so the video
 * doesn't feel repetitive.
 */
export function pickProceduralVariant(sceneType: string, sceneId: number | string): BgVariant {
  const variants: BgVariant[] = [
    "mesh",
    "blueprint",
    "scanlines",
    "neonRays",
    "hologram",
    "bokeh",
    "circuit",
    "waveform",
  ];
  const idNum = typeof sceneId === "number" ? sceneId : hashString(String(sceneId));
  const typeHash = hashString(sceneType);
  return variants[(idNum + typeHash) % variants.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

// ----- Variant implementations -----

const MeshGradient: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const t = frame * 0.4;
  return (
    <AbsoluteFill style={{ zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at ${30 + Math.sin(t / 30) * 20}% ${40 + Math.cos(t / 25) * 20}%, ${accentColor}66 0%, transparent 50%),
            radial-gradient(circle at ${70 + Math.cos(t / 35) * 15}% ${60 + Math.sin(t / 28) * 18}%, ${accentColor}44 0%, transparent 55%),
            radial-gradient(circle at ${50 + Math.sin(t / 20) * 25}% ${80 + Math.cos(t / 22) * 12}%, ${accentColor}22 0%, transparent 60%),
            linear-gradient(135deg, #050505 0%, #0a0a0a 100%)
          `,
          filter: "saturate(1.3)",
        }}
      />
    </AbsoluteFill>
  );
};

const BlueprintGrid: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 60;
  return (
    <AbsoluteFill style={{ background: "#020610", zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${accentColor}33 1px, transparent 1px),
            linear-gradient(90deg, ${accentColor}33 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          backgroundPosition: `${offset}px ${offset}px`,
          maskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${accentColor}22 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const ScanLines: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const scanY = (frame * 8) % 1920;
  return (
    <AbsoluteFill style={{ background: "#050505", zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 3px,
            ${accentColor}11 3px,
            ${accentColor}11 4px
          )`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: scanY - 60,
          left: 0,
          right: 0,
          height: 120,
          background: `linear-gradient(180deg, transparent 0%, ${accentColor}55 50%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

const NeonRays: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const rotate = frame * 0.3;
  return (
    <AbsoluteFill style={{ background: "#050505", zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          width: 3000,
          height: 3000,
          left: -960,
          top: -540,
          background: `conic-gradient(
            from ${rotate}deg,
            transparent 0deg,
            ${accentColor}22 15deg,
            transparent 30deg,
            ${accentColor}44 60deg,
            transparent 75deg,
            ${accentColor}22 120deg,
            transparent 135deg,
            ${accentColor}33 180deg,
            transparent 195deg,
            ${accentColor}44 240deg,
            transparent 255deg,
            ${accentColor}22 300deg,
            transparent 315deg,
            transparent 360deg
          )`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.7) 80%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Hologram: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const shimmer = interpolate((frame % 60) / 60, [0, 0.5, 1], [0, 1, 0]);
  return (
    <AbsoluteFill style={{ background: "#020a08", zIndex: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            -45deg,
            transparent 0px,
            transparent 8px,
            ${accentColor}10 8px,
            ${accentColor}10 9px
          )`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${accentColor}22 0%, transparent 50%, ${accentColor}33 100%)`,
          opacity: 0.4 + 0.4 * shimmer,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at top, ${accentColor}33 0%, transparent 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Bokeh: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const circles = React.useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        x: ((i * 137) % 100) / 100,
        y: ((i * 211) % 100) / 100,
        size: 80 + ((i * 53) % 220),
        speed: 0.2 + ((i * 7) % 10) / 30,
        phase: i * 0.7,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ background: "#06080d", zIndex: 0 }}>
      {circles.map((c, i) => {
        const drift = Math.sin(frame * c.speed * 0.05 + c.phase) * 40;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              width: c.size,
              height: c.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)`,
              filter: "blur(20px)",
              transform: `translate(${drift}px, ${drift * 0.6}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Circuit: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#050708", zIndex: 0 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        style={{ position: "absolute", inset: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="circuitGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {Array.from({ length: 10 }).map((_, i) => {
          const y = 100 + i * 180;
          const dashOffset = -((frame * 4 + i * 50) % 400);
          return (
            <g key={i}>
              <path
                d={`M 0 ${y} L 200 ${y} L 240 ${y + 40} L 480 ${y + 40} L 520 ${y} L 720 ${y} L 760 ${y - 40} L 1080 ${y - 40}`}
                stroke="url(#circuitGrad)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="20 12"
                strokeDashoffset={dashOffset}
              />
              <circle cx="240" cy={y + 40} r="6" fill={accentColor} opacity="0.8" />
              <circle cx="520" cy={y} r="4" fill={accentColor} opacity="0.6" />
              <circle cx="760" cy={y - 40} r="6" fill={accentColor} opacity="0.8" />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const WavePattern: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#040810", zIndex: 0 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        style={{ position: "absolute", inset: 0 }}
        preserveAspectRatio="none"
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const yBase = 240 + i * 200;
          const phase = frame * 0.04 + i * 0.7;
          const path = `M 0 ${yBase} ${Array.from({ length: 12 })
            .map((__, k) => {
              const x = (k + 1) * 90;
              const y = yBase + Math.sin(phase + k * 0.6) * (20 + i * 4);
              return `L ${x} ${y}`;
            })
            .join(" ")}`;
          return (
            <path
              key={i}
              d={path}
              stroke={accentColor}
              strokeOpacity={0.15 + (i % 3) * 0.1}
              strokeWidth="3"
              fill="none"
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 0%, ${accentColor}11 50%, transparent 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
