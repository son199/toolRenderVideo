"""ContentAnalyzerAgent — LLM call 1 in the agent chain.

Reads raw_text and returns an ``AnalyzerResult`` Pydantic model that downstream
agents use to pin hook, tone, and key facts. Never writes a storyboard.
Uses ``_complete_with_retry`` because structured JSON output can fail on first
attempt with some LLM providers.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.agents.base import AgentError, BaseAgent
from app.agents.prompts.analyzer import ANALYZER_SYSTEM_PROMPT, build_analyzer_user_prompt
from app.services.llm._json import parse_json_model
from app.services.llm.base import LLMError

# TTS reading speed per language — used by reviewer B2 caption budget check
# and can be injected into storyboard hints.
TTS_WORDS_PER_SEC: dict[str, float] = {
    "vi": 2.8,   # tiếng Việt TTS (Vbee / FPT.AI calibrated)
    "en": 2.5,   # English TTS
    "default": 2.8,
}


class AnalyzerResult(BaseModel):
    primary_hook: str
    main_number: str = ""
    theme: Literal["danger", "warning", "default", "success"] = "default"
    tone: Literal["factual", "urgent", "inspiring", "playful", "educational"]
    key_facts: list[str] = Field(default_factory=list)
    suggested_scene_count: int = Field(ge=3, le=20)
    language_register: str
    content_summary: str
    # Optional: visual style hint for Remotion/Hyperframes render engine
    visual_style: Literal["text-dominant", "split-screen", "kinetic-typography", "b-roll", "kinetic-remotion"] = "kinetic-remotion"
    # Scene-type mix gợi ý cho LLM storyboard — keys phải nằm trong SCENE_TYPES
    # (xem app.services.scene_types). Mặc định trống → analyzer suy ra trong post-process.
    scene_type_mix: dict[str, int] = Field(default_factory=dict)


def _derive_scene_type_mix(
    tone: str,
    theme: str,
    template: str,
    scene_count: int,
) -> dict[str, int]:
    """Suy ra mix scene-type từ tone/theme/template khi LLM analyzer chưa tự đề xuất.

    Mục tiêu: luôn có ≥3 type khác nhau, mở bằng hero/stat, đóng bằng cta.
    """
    # Base: hook + closing
    mix: dict[str, int] = {"hero": 1, "cta": 1}
    remaining = max(0, scene_count - 2)

    if tone == "urgent" or theme == "danger":
        # Tin tức/cảnh báo: nhiều stat + comparison
        plan = ["stat", "comparison", "stat", "kinetic", "list"]
    elif tone == "inspiring" or theme == "success":
        # Motivational: nhiều quote + hero
        plan = ["quote", "stat", "kinetic", "list", "quote"]
    elif tone == "educational":
        plan = ["list", "comparison", "stat", "kinetic", "quote"]
    elif tone == "playful":
        plan = ["kinetic", "stat", "product", "comparison", "kinetic"]
    else:  # factual / default
        plan = ["stat", "kinetic", "list", "comparison", "quote"]

    if template == "promo":
        # Promo nghiêng về product + cta
        plan = ["product", "stat", "comparison", "product", "kinetic"]

    for i in range(remaining):
        t = plan[i % len(plan)]
        mix[t] = mix.get(t, 0) + 1
    return mix


class ContentAnalyzerAgent(BaseAgent):
    stage_name = "analyzer"

    async def run(self, *, raw_text: str, template: str) -> AnalyzerResult:
        await self._emit(self.stage_name, 0.10, "Đang phân tích nội dung...")
        raw = await self._complete_with_retry(
            system=ANALYZER_SYSTEM_PROMPT,
            user=build_analyzer_user_prompt(raw_text=raw_text, template=template),
            max_tokens=1024,
        )
        try:
            result = parse_json_model(raw, AnalyzerResult)
        except LLMError as exc:
            raise AgentError(self.stage_name, str(exc)) from exc

        # Backfill scene_type_mix nếu LLM analyzer không tự đề xuất → đảm bảo
        # storyboard prompt luôn có gợi ý đa dạng visual.
        if not result.scene_type_mix:
            result.scene_type_mix = _derive_scene_type_mix(
                tone=result.tone,
                theme=result.theme,
                template=template,
                scene_count=result.suggested_scene_count,
            )

        mix_summary = ", ".join(f"{k}×{v}" for k, v in result.scene_type_mix.items())
        await self._emit(
            self.stage_name,
            0.25,
            f"Hook: {result.primary_hook[:50]} · theme={result.theme} · mix=[{mix_summary}]",
        )
        return result