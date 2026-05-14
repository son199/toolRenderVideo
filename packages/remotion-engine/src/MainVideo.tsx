import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { KineticScene } from "./components/KineticScene";

export const MainVideo: React.FC<{ scenes: any[], template: string, theme: string }> = ({ scenes, template, theme }) => {
  const { fps } = useVideoConfig();

  let accumulatedTime = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#050505", color: "white" }}>
      {scenes.map((scene, index) => {
        const startFrame = Math.round(accumulatedTime * fps);
        const durationInFrames = Math.round(scene.duration_sec * fps);
        
        accumulatedTime += scene.duration_sec;

        return (
          <Sequence
            key={scene.id || index}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <KineticScene scene={scene} template={template} theme={theme} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
