import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { SceneRouter } from "./components/SceneRouter";
import type { ThemeName } from "./components/shared/SceneBackground";

export const MainVideo: React.FC<{ scenes: any[], template: string, theme: string }> = ({ scenes, template, theme }) => {
  const { fps } = useVideoConfig();
  const safeTheme: ThemeName = (["danger", "warning", "default", "success"].includes(theme)
    ? theme
    : "default") as ThemeName;

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
            <SceneRouter scene={scene} template={template} theme={safeTheme} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
