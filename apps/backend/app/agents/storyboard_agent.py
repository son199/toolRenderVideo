"""StoryboardAgent — LLM call 2 in the chain.

Takes an ``AnalyzerResult`` plus raw text and drafts a ``Storyboard`` JSON. The
system prompt is the per-niche SKILL.md (same as Phase 1 one-shot path) so the
template's style guide still drives structure; the user prompt extends with
analyzer hints to anchor the hook, tone, and key facts.
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
        await self._emit(self.stage_name, 0.30, "Đang sinh storyboard draft...")
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

        # Phase 2G: ensure storyboard.theme reflects the analyzer's classification.
        # If LLM already populated theme matching analyzer.theme → no-op.
        # If LLM left default or wrote something else → analyzer is authoritative
        # because it ran first with full content access. Skips override only when
        # the LLM explicitly set a non-default theme that disagrees and the
        # analyzer also disagrees (rare — usually they align).
        if storyboard.theme == "default" and analyzer.theme != "default":
            storyboard = storyboard.model_copy(update={"theme": analyzer.theme})

        await self._emit(
            self.stage_name,
            0.45,
            f"Draft ready: {len(storyboard.scenes)} scenes, "
            f"{storyboard.total_duration_sec:.1f}s, theme={storyboard.theme}",
        )
        return storyboard
