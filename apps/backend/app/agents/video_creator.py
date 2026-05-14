"""VideoCreatorAgent — master orchestrator of the agent chain.

Sequences ContentAnalyzer → StoryboardAgent → ReviewAgent and, when review
fails, one refine pass followed by a second review to verify quality.
Returns a ``GenerationResult`` with the final storyboard + quality metadata.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.agents.base import BaseAgent, ProgressCallback
from app.agents.content_analyzer import AnalyzerResult, ContentAnalyzerAgent
from app.agents.review_agent import ReviewAgent, ReviewResult
from app.agents.storyboard_agent import StoryboardAgent
from app.schemas.storyboard import Storyboard
from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Carries the final storyboard plus quality metadata for callers."""

    storyboard: Storyboard
    analyzer: AnalyzerResult
    review: ReviewResult          # review of the FINAL storyboard (post-refine if refined)
    was_refined: bool = False
    pre_refine_score: float | None = None

    @property
    def quality_ok(self) -> bool:
        return self.review.passed

    def summary(self) -> str:
        parts = [f"score={self.review.score:.1f}/10"]
        if self.was_refined and self.pre_refine_score is not None:
            parts.append(f"(trước refine: {self.pre_refine_score:.1f})")
        parts.append(f"scenes={len(self.storyboard.scenes)}")
        parts.append(f"duration={self.storyboard.total_duration_sec:.1f}s")
        return " · ".join(parts)


class VideoCreatorAgent(BaseAgent):
    stage_name = "agent"

    def __init__(
        self,
        provider: LLMProvider,
        progress: ProgressCallback | None = None,
    ) -> None:
        super().__init__(provider, progress)
        self._analyzer = ContentAnalyzerAgent(provider, progress)
        self._writer = StoryboardAgent(provider, progress)
        self._reviewer = ReviewAgent(provider, progress)

    async def generate(
        self,
        *,
        raw_text: str,
        template: str,
        aspect_ratio: str,
        voice: str | None,
    ) -> GenerationResult:
        await self._emit("agent", 0.05, "AI Agent bắt đầu phân tích...")

        # 1 — Analyze
        analyzer_result = await self._analyzer.run(raw_text=raw_text, template=template)

        # 2 — Draft
        draft = await self._writer.run(
            raw_text=raw_text,
            analyzer=analyzer_result,
            template=template,
            aspect_ratio=aspect_ratio,
            voice=voice,
        )

        # 3 — Review draft
        review = await self._reviewer.run(
            storyboard=draft,
            raw_text=raw_text,
            analyzer=analyzer_result,
            template=template,
        )

        if review.passed:
            await self._emit("agent", 0.95, f"Review pass (score {review.score:.1f}/10) — không cần refine")
            return GenerationResult(
                storyboard=draft,
                analyzer=analyzer_result,
                review=review,
                was_refined=False,
            )

        # 4 — Refine (1 lần, cap cost)
        logger.info(
            "VideoCreatorAgent: review failed (score=%.1f, %d issues) — refining",
            review.score, len(review.issues),
        )
        pre_refine_score = review.score

        refined = await self._reviewer.refine(
            draft=draft, review=review, raw_text=raw_text, template=template,
        )

        # 5 — Re-review để có quality signal chính xác sau refine
        await self._emit("agent", 0.88, "Đang verify storyboard sau refine...")
        post_review = await self._reviewer.run(
            storyboard=refined,
            raw_text=raw_text,
            analyzer=analyzer_result,
            template=template,
        )

        if not post_review.passed:
            logger.warning(
                "VideoCreatorAgent: refined still failed (score %.1f → %.1f). Returning best available.",
                pre_refine_score, post_review.score,
            )

        await self._emit("agent", 0.95, f"Refined: {pre_refine_score:.1f} → {post_review.score:.1f}/10")
        return GenerationResult(
            storyboard=refined,
            analyzer=analyzer_result,
            review=post_review,
            was_refined=True,
            pre_refine_score=pre_refine_score,
        )