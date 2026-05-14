import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Random number generator with seed
const random = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const Particles: React.FC<{ count?: number, speed?: number }> = ({ count = 30, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate deterministic particles so they render exactly the same way every time
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: random(i * 10) * 100, // 0 to 100%
      y: random(i * 20) * 100, // 0 to 100%
      size: random(i * 30) * 6 + 2, // 2px to 8px
      speedX: (random(i * 40) - 0.5) * 2 * speed, // Drift X
      speedY: (random(i * 50) - 0.5) * -4 * speed, // Drift Y (mostly up)
      opacity: random(i * 60) * 0.5 + 0.1, // 0.1 to 0.6
      color: random(i * 70) > 0.8 ? "#38bdf8" : (random(i * 80) > 0.5 ? "#fbbf24" : "#ffffff") // Random mix of Blue, Amber, White
    }));
  }, [count, speed]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", zIndex: 10, pointerEvents: "none" }}>
      {particles.map((p, i) => {
        // Calculate current position based on frame
        const currentX = (p.x + (frame / fps) * p.speedX * 10) % 100;
        const currentY = (p.y + (frame / fps) * p.speedY * 10);
        
        // Wrap around Y
        const wrappedY = currentY < -10 ? 110 : currentY > 110 ? -10 : currentY;

        // Twinkle effect (sine wave based on frame)
        const twinkle = Math.sin(frame / 10 + i) * 0.3 + 0.7; // 0.4 to 1.0 multiplier

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${currentX}%`,
              top: `${wrappedY}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: "50%",
              opacity: p.opacity * twinkle,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
