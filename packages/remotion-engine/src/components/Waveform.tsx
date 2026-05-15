import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

export type WaveformPosition = "top" | "bottom" | "none";

export const Waveform: React.FC<{
  audioSrc: string;
  color?: string;
  position?: WaveformPosition;
}> = ({ audioSrc, color = "#38bdf8", position = "bottom" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioSrc);

  if (!audioData || position === "none") {
    return null;
  }

  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 64,
  });

  const isTop = position === "top";

  return (
    <AbsoluteFill
      style={{
        justifyContent: isTop ? "flex-start" : "flex-end",
        alignItems: "center",
        paddingTop: isTop ? "80px" : 0,
        paddingBottom: isTop ? 0 : "80px",
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "120px" }}>
        {visualization.map((v, i) => {
          const height = Math.max(8, v * 280);
          return (
            <div
              key={i}
              style={{
                width: "8px",
                height: `${height}px`,
                backgroundColor: color,
                borderRadius: "10px",
                boxShadow: `0 0 15px ${color}`,
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
