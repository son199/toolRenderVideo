"""Claude / Anthropic provider — supports custom base_url for proxy gateways."""

from __future__ import annotations

import logging

import anthropic

from app.config import get_settings
from app.schemas.storyboard import Storyboard
from app.services.llm._json import parse_storyboard
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.prompts import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


class ClaudeProvider(LLMProvider):
    """Wraps `anthropic.Anthropic` with our storyboard prompt + JSON parser."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set")

        kwargs: dict = {"api_key": settings.anthropic_api_key}
        if settings.anthropic_base_url:
            kwargs["base_url"] = settings.anthropic_base_url

        self._client = anthropic.Anthropic(**kwargs)
        self._model = settings.anthropic_model

    def complete(self, *, system: str, user: str, max_tokens: int = 4096) -> str:
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.APIStatusError as exc:
            raise LLMError(f"Anthropic API error ({exc.status_code}): {exc.message}") from exc
        except anthropic.APIConnectionError as exc:
            raise LLMError(f"Anthropic connection error: {exc}") from exc

        text_blocks = [b.text for b in (response.content or []) if b.type == "text"]
        if not text_blocks:
            raise LLMError("Anthropic response had no text content")

        logger.info(
            "Claude call: input=%s output=%s cache_read=%s",
            response.usage.input_tokens,
            response.usage.output_tokens,
            getattr(response.usage, "cache_read_input_tokens", None),
        )
        return "\n".join(text_blocks)

    def generate_storyboard(
        self,
        text: str,
        *,
        template: str,
        aspect_ratio: str,
        voice: str | None,
    ) -> Storyboard:
        raw = self.complete(
            system=build_system_prompt(template),
            user=build_user_prompt(
                text=text, template=template, aspect_ratio=aspect_ratio, voice=voice
            ),
            max_tokens=4096,
        )
        return parse_storyboard(raw)
