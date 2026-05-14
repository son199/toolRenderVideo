import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

export const Waveform: React.FC<{ audioSrc: string, color?: string }> = ({ audioSrc, color = "#38bdf8" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Load audio data for visualization
  const audioData = useAudioData(audioSrc);

  if (!audioData) {
    return null;
  }

  // Generate 64 frequency bars for the current frame
  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 64,
  });

  return (
    <AbsoluteFill style={{ 
      justifyContent: "flex-end", 
      alignItems: "center", 
      paddingBottom: "80px", // Put it near the bottom
      zIndex: 20,
      pointerEvents: "none"
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "120px" }}>
        {visualization.map((v, i) => {
          // Amp up the visualizer height, maxing out cleanly
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
