import { Composition, getInputProps } from "remotion";
import { MainVideo } from "./MainVideo";

// This defines the video template
export const RemotionRoot: React.FC = () => {
  // Nhận dữ liệu động từ Python truyền vào qua CLI (--props)
  const inputProps = getInputProps();
  const scenes = inputProps.scenes || [
    {
      id: "1",
      text: "Đây là kỷ nguyên của AI tự động hóa hoàn toàn.",
      visual_prompt: "cyberpunk robot typing on glowing keyboard",
      duration_sec: 4,
      audio_path: null,
      word_timings: [
        { word: "Đây", start: 0, end: 0.5 },
        { word: "là", start: 0.5, end: 0.8 },
      ]
    }
  ];

  // Tính tổng số Frame của toàn bộ video
  const fps = 30;
  const totalDurationFrames = scenes.reduce((acc: number, scene: any) => acc + Math.round(scene.duration_sec * fps), 0);

  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={Math.max(totalDurationFrames, 30)}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{ 
          scenes, 
          template: inputProps.template || "news",
          theme: inputProps.theme || "default"
        }}
      />
    </>
  );
};
