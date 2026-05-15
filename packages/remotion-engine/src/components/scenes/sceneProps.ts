import type { ThemeName } from "../shared/SceneBackground";

/**
 * Props chung cho mọi scene component. Mỗi component nhận cùng input shape →
 * SceneRouter chỉ cần đổi component, không đổi data.
 */
export interface SceneProps {
  scene: any;           // storyboard scene object từ backend
  template: string;     // news | promo | motivational (legacy hint)
  theme: ThemeName;
}

/**
 * Theme → accent color (highlight cho từ active, glow border, v.v.).
 * Đồng bộ với THEME_GRADIENT trong SceneBackground.
 */
export function resolveAccent(theme: ThemeName): string {
  switch (theme) {
    case "danger":
      return "#ff4d4d";
    case "success":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    default:
      return "#fbbf24";
  }
}

/**
 * Theme + template → badge text + gradient. Hero/CTA scenes hiển thị badge ở top.
 */
export function resolveBadge(
  theme: ThemeName,
  template: string,
): { text: string; gradient: string } | null {
  if (template === "news") {
    return {
      text: "TIN TỨC MỚI NHẤT",
      gradient:
        theme === "danger"
          ? "linear-gradient(90deg, #7f1d1d 0%, #ef4444 100%)"
          : "linear-gradient(90deg, #9b1c1c 0%, #ef4444 100%)",
    };
  }
  if (template === "motivational") {
    return { text: "CẢM HỨNG", gradient: "linear-gradient(90deg, #1e293b 0%, #475569 100%)" };
  }
  if (template === "promo") {
    return { text: "GIẢI PHÁP MỚI", gradient: "linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)" };
  }
  return null;
}
