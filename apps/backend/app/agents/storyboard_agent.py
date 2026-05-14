"""StoryboardAgent — Bước 2 trong chuỗi xử lý AI.

Nhận kết quả từ ContentAnalyzer và nội dung thô để biên soạn Storyboard JSON.
Hệ thống sử dụng các chỉ dẫn từ Analyzer để tối ưu hóa Hook, Tone và Key Facts
cho Remotion Engine, đảm bảo video có nhịp điệu và hình ảnh sống động.
"""

from __future__ import annotations

from app.agents.base import AgentError, BaseAgent
from app.agents.content_analyzer import AnalyzerResult
from app.schemas.storyboard import Storyboard
from app.services.llm._json import parse_storyboard
from app.services.llm.base import LLMError
from app.services.llm.prompts import (
    build_storyboard_user_prompt_with_analysis,
    build_system_prompt,
)


class StoryboardAgent(BaseAgent):
    stage_name = "storyboard"

    async def run(
        self,
        *,
        raw_text: str,
        analyzer: AnalyzerResult,
        template: str,
        aspect_ratio: str,
        voice: str | None,
    ) -> Storyboard:
        await self._emit(self.stage_name, 0.30, "AI đang biên soạn kịch bản hình ảnh (Remotion Optimized)...")
        raw = await self._complete(
            system=build_system_prompt(template),
            user=build_storyboard_user_prompt_with_analysis(
                text=raw_text,
                template=template,
                aspect_ratio=aspect_ratio,
                voice=voice,
                analyzer_hints=analyzer.model_dump(),
            ),
            max_tokens=4096,
        )
        try:
            storyboard = parse_storyboard(raw)
        except LLMError as exc:
            raise AgentError(self.stage_name, str(exc)) from exc

        # Đồng bộ theme từ analyzer nếu LLM để mặc định
        if storyboard.theme == "default" and analyzer.theme != "default":
            storyboard = storyboard.model_copy(update={"theme": analyzer.theme})

        await self._emit(
            self.stage_name,
            0.45,
            f"Kịch bản đã sẵn sàng: {len(storyboard.scenes)} scenes, "
            f"{storyboard.total_duration_sec:.1f}s, sắc thái={storyboard.theme}",
        )
        return storyboard
