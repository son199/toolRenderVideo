import React from "react";
import { KineticScene } from "./KineticScene";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { ComparisonScene } from "./scenes/ComparisonScene";
import { CtaScene } from "./scenes/CtaScene";
import { ExplainerScene } from "./scenes/ExplainerScene";
import { GridScene } from "./scenes/GridScene";
import { HeroScene } from "./scenes/HeroScene";
import { ListScene } from "./scenes/ListScene";
import { ProductScene } from "./scenes/ProductScene";
import { QuoteScene } from "./scenes/QuoteScene";
import { StatScene } from "./scenes/StatScene";
import { TerminalScene } from "./scenes/TerminalScene";
import { TimelineScene } from "./scenes/TimelineScene";
import type { SceneProps } from "./scenes/sceneProps";
import { resolveSceneType, type SceneType } from "./scenes/types";

const REGISTRY: Record<SceneType, React.FC<SceneProps>> = {
  hero: HeroScene,
  stat: StatScene,
  quote: QuoteScene,
  comparison: ComparisonScene,
  list: ListScene,
  product: ProductScene,
  cta: CtaScene,
  terminal: TerminalScene,
  timeline: TimelineScene,
  grid: GridScene,
  explainer: ExplainerScene,
  // Legacy fallback — giữ KineticScene cũ (component 239 dòng) cho mọi scene
  // không match type mới hoặc khi SceneErrorBoundary phải nhảy vào.
  kinetic: KineticScene as unknown as React.FC<SceneProps>,
};

/**
 * Dispatch scene → component theo `scene.type`. Bọc trong ErrorBoundary để 1
 * scene lỗi không phá toàn video — fallback về KineticScene.
 */
export const SceneRouter: React.FC<SceneProps> = (props) => {
  const sceneType = resolveSceneType(props.scene?.type);
  const Component = REGISTRY[sceneType];
  return (
    <SceneErrorBoundary fallback={<KineticScene {...(props as any)} />}>
      <Component {...props} />
    </SceneErrorBoundary>
  );
};
