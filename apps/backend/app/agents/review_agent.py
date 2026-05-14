"""ReviewAgent — Chuyên gia kiểm duyệt và tinh chỉnh kịch bản.

Đánh giá Storyboard dựa trên các tiêu chí về nhịp điệu, hình ảnh và độ chính xác
nội dung cho Remotion Engine. Nếu kịch bản không đạt yêu cầu, agent sẽ tự động
thực hiện bước tinh chỉnh (refine) để cải thiện chất lượng.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.agents.base import AgentError, BaseAgent
from app.agents.content_analyzer import AnalyzerResult
from app.agents.prompts.refine import build_refine_user_prompt
from app.agents.prompts.reviewer import REVIEWER_SYSTEM_PROMPT, build_review_user_prompt
from app.schemas.storyboard import Storyboard
from app.services.llm._json import parse_json_model, parse_storyboard
from app.services.llm.base import LLMError
from app.services.llm.prompts import build_system_prompt


class ReviewIssue(BaseModel):
    scene_id: int | None = None
    severity: Literal["high", "low"]
    issue: str
    suggested_fix: str


class ReviewResult(BaseModel):
    passed: bool
    score: float = Field(ge=0.0, le=10.0)
    issues: list[ReviewIssue] = Field(default_factory=list)
    overall_feedback: str = ""

    @property
    def has_high_severity(self) -> bool:
        return any(i.severity == "high" for i in self.issues)


class ReviewAgent(BaseAgent):
    stage_name = "review"

    async def run(
        self,
        *,
        storyboard: Storyboard,
        raw_text: str,
        analyzer: AnalyzerResult,
        template: str,
    ) -> ReviewResult:
        await self._emit(self.stage_name, 0.50, "Reviewer đang kiểm tra chất lượng kịch bản...")
        raw = await self._complete_with_retry(
            system=REVIEWER_SYSTEM_PROMPT,
            user=build_review_user_prompt(
                raw_text=raw_text,
                analyzer_summary=analyzer.content_summary,
                storyboard_json=storyboard.model_dump_json(indent=2),
                template=template,
                analyzer_main_number=analyzer.main_number,
                analyzer_theme=analyzer.theme,
            ),
            max_tokens=2048,
        )
        try:
            result = parse_json_model(raw, ReviewResult)
        except LLMError as exc:
            raise AgentError(self.stage_name, str(exc)) from exc

        # Conservative override: if score low or any high-severity issue,
        # mark failed even if LLM claimed passed=True.
        if result.score < 7.0 or result.has_high_severity:
            result = result.model_copy(update={"passed": False})

        await self._emit(
            self.stage_name,
            0.65,
            f"Điểm chất lượng: {result.score:.1f}/10 · {len(result.issues)} vấn đề · Vượt qua: {result.passed}",
        )
        return result

    async def refine(
        self,
        *,
        draft: Storyboard,
        review: ReviewResult,
        raw_text: str,
        template: str,
    ) -> Storyboard:
        """Tinh chỉnh storyboard dựa trên phản hồi của Reviewer."""
        await self._emit("refine", 0.70, "AI đang tự động sửa lỗi và tối ưu hóa kịch bản...")
        raw = await self._complete_with_retry(
            system=build_system_prompt(template),
            user=build_refine_user_prompt(
                draft_storyboard_json=draft.model_dump_json(indent=2),
                review_feedback_json=review.model_dump_json(indent=2),
                raw_text=raw_text,
            ),
            max_tokens=4096,
        )
        try:
            refined = parse_storyboard(raw)
        except LLMError as exc:
            raise AgentError("refine", str(exc)) from exc
        await self._emit(
            "refine",
            0.85,
            f"Refined: {len(refined.scenes)} scenes, {refined.total_duration_sec:.1f}s",
        )
        return refined