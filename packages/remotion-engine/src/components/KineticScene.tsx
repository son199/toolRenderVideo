import React from "react";
import { AbsoluteFill, Audio, Img, Video, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { Particles } from "./Particles";
import { Waveform } from "./Waveform";

export const KineticScene: React.FC<{ scene: any, template: string, theme: string }> = ({ scene, template, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ----- THEME & MOOD CONFIGURATION -----
  let badgeText = "";
  let badgeColor = "linear-gradient(90deg, #1e293b 0%, #334155 100%)";
  let highlightColor = "#fbbf24"; 
  let fontFam = "'Inter', sans-serif";
  let glassBg = "rgba(0, 0, 0, 0.6)";
  
  // 1. Base on Template
  if (template === "news") {
    badgeText = "TIN TỨC MỚI NHẤT";
    badgeColor = "linear-gradient(90deg, #9b1c1c 0%, #ef4444 100%)";
    highlightColor = "#ef4444";
  } else if (template === "motivational") {
    fontFam = "'Outfit', sans-serif";
    glassBg = "transparent";
    badgeText = "CẢM HỨNG";
  }

  // 2. Override based on Theme (Mood)
  if (theme === "danger") {
    highlightColor = "#ff4d4d";
    badgeColor = "linear-gradient(90deg, #7f1d1d 0%, #ef4444 100%)";
  } else if (theme === "success") {
    highlightColor = "#10b981";
    badgeColor = "linear-gradient(90deg, #064e3b 0%, #10b981 100%)";
  } else if (theme === "warning") {
    highlightColor = "#f59e0b";
  }

  // ----- ANIMATIONS & TIMINGS -----
  // Fallback: Nếu thiếu word_timings (khi xem trước storyboard), tự tạo nhịp điệu giả lập
  const words = React.useMemo(() => {
    if (scene.word_timings && scene.word_timings.length > 0) return scene.word_timings;
    
    const textToSplit = scene.text || scene.headline || "";
    const splitWords = textToSplit.split(" ");
    return splitWords.map((word: string, i: number) => ({
      word,
      start: (scene.duration_sec / splitWords.length) * i,
      end: (scene.duration_sec / splitWords.length) * (i + 1)
    }));
  }, [scene.word_timings, scene.text, scene.headline, scene.duration_sec]);

  // Zoom chậm từ 1.0 đến 1.25 (Ken Burns nâng cao)
  const scale = interpolate(
    frame,
    [0, Math.round(scene.duration_sec * fps)],
    [1, 1.25],
    { extrapolateRight: "clamp" }
  );

  // Hiệu ứng mờ ảo (Vignette)
  const vignetteOpacity = interpolate(frame, [0, 15], [0, 0.7], { extrapolateRight: "clamp" });

  // Sử dụng ảnh nền đã được tải về từ Python backend để đảm bảo ổn định
  const bgUrl = scene.background_image 
    ? staticFile(scene.background_image)
    : null;

  const [imgError, setImgError] = React.useState(false);

  return (
    <AbsoluteFill style={{ 
      overflow: "hidden", 
      background: "linear-gradient(135deg, #050505 0%, #1a1a1a 100%)"
    }}>
      {/* 0. Voiceover Audio */}
      {scene.audio_path && (
        <Audio src={staticFile(scene.audio_path)} />
      )}

      {/* 1. Base Layer (Dynamic CSS Gradient) */}
      <AbsoluteFill style={{
        background: theme === "success" 
          ? "linear-gradient(135deg, #001510 0%, #004d40 50%, #001510 100%)"
          : theme === "danger"
          ? "linear-gradient(135deg, #1a0000 0%, #7f0000 50%, #1a0000 100%)"
          : theme === "warning"
          ? "linear-gradient(135deg, #1a1000 0%, #ff8f00 50%, #1a1000 100%)"
          : "linear-gradient(135deg, #050505 0%, #1a1a1a 50%, #050505 100%)",
        filter: "contrast(1.2)",
        zIndex: -1
      }} />

      {/* 1.1. Background Image Overlay */}
      {bgUrl && (
        <Img 
          src={bgUrl} 
          onError={() => setImgError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: "brightness(0.35) contrast(1.1)",
            zIndex: 0
          }}
        />
      )}

      {/* 1.2. Background Video Overlay */}
      {scene.video_path && (
        <Video 
          crossOrigin="anonymous"
          src={scene.video_path.startsWith("http") ? scene.video_path : staticFile(scene.video_path)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: "brightness(0.3) contrast(1.2) saturate(1.1)",
            opacity: 1,
            zIndex: 1
          }}
        />
      )}

      {/* 1.2. Vignette & Glow Overlay */}
      <AbsoluteFill style={{
        background: `radial-gradient(circle, transparent 20%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
        boxShadow: "inset 0 0 150px rgba(0,0,0,0.8)"
      }} />

      {/* 1.5. Particles Overlay */}
      <Particles count={60} speed={1.2} />

      {/* 1.8. Waveform Visualizer */}
      {scene.audio_path && (
        <Waveform audioSrc={staticFile(scene.audio_path)} color={highlightColor} />
      )}

      {/* 2. Main Content UI */}
      <AbsoluteFill style={{ 
        justifyContent: "center", 
        alignItems: "center", 
        padding: "80px",
        fontFamily: fontFam 
      }}>
        
        {/* Badge with Slide-In animation */}
        {badgeText && (
          <div style={{
            position: "absolute",
            top: "12%",
            background: badgeColor,
            padding: "18px 45px",
            borderRadius: "60px",
            color: "white",
            fontWeight: 900,
            fontSize: "30px",
            letterSpacing: "0.25em",
            boxShadow: `0 15px 40px rgba(0, 0, 0, 0.5), 0 0 20px ${highlightColor}44`,
            textTransform: "uppercase",
            transform: `translateY(${spring({ frame, fps, config: { damping: 12 } }) * 20 - 20}px)`,
            opacity: spring({ frame, fps }),
          }}>
            {badgeText}
          </div>
        )}

        {/* Text Container with Glassmorphism */}
        <div style={{
          background: glassBg,
          backdropFilter: template === "motivational" ? "none" : "blur(30px)",
          WebkitBackdropFilter: template === "motivational" ? "none" : "blur(30px)",
          border: template === "motivational" ? "none" : "2px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "56px",
          padding: template === "motivational" ? "0" : "85px 60px",
          width: "100%",
          boxShadow: template === "motivational" ? "none" : "0 40px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "18px 24px",
          textAlign: "center",
        }}>
          {words.map((timing: any, i: number) => {
            const startFrame = Math.round(timing.start * fps);
            const endFrame = Math.round(timing.end * fps);
            
            // Animation state
            const isActive = frame >= startFrame && frame <= endFrame + (fps * 0.5);
            const hasSpoken = frame > endFrame;
            
            // Spring physics for word entrance
            const wordSpring = spring({
              frame: frame - startFrame,
              fps,
              config: { damping: 12, stiffness: 180, mass: 0.8 }
            });

            const wordScale = interpolate(wordSpring, [0, 1], [0.5, 1]);
            const wordY = interpolate(wordSpring, [0, 1], [30, 0]);

            if (frame < startFrame) return null;

            return (
              <React.Fragment key={i}>
                {/* Subtle 'Pop' sound on word entrance */}
                {frame === startFrame && (
                  <Audio 
                    src="https://actions.google.com/sounds/v1/ui/analog_watch_alarm_click.ogg" 
                    volume={0.1} 
                  />
                )}
                
                <span 
                  style={{
                    fontSize: "82px",
                    fontWeight: template === "motivational" ? "normal" : 900,
                    fontStyle: template === "motivational" ? "italic" : "normal",
                    color: isActive ? highlightColor : "#ffffff",
                    transform: `scale(${wordScale}) translateY(${wordY}px)`,
                    textShadow: isActive 
                      ? `0 0 50px ${highlightColor}cc, 0 0 15px ${highlightColor}` 
                      : "0 6px 20px rgba(0,0,0,0.95)",
                    opacity: isActive ? 1 : (hasSpoken ? 0.7 : 0),
                    display: "inline-block",
                    lineHeight: "1.1",
                    textTransform: template === "motivational" ? "none" : "uppercase",
                    filter: isActive ? "brightness(1.2)" : "none",
                  }}
                >
                  {timing.word}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
