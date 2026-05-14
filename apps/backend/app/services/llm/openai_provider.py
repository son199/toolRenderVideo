"""OpenAI provider — uses JSON object response_format for reliable parsing.

For storyboard calls (always JSON), ``generate_storyboard`` sets
``response_format=json_object``. Generic ``complete()`` does NOT force JSON so
agents can prompt for analyzer / reviewer text too.
"""

from __future__ import annotations

import logging

import openai

from app.config import get_settings
from app.schemas.storyboard import Storyboard
from app.services.llm._json import parse_storyboard
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.prompts import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise LLMError("OPENAI_API_KEY is not set")

        kwargs: dict = {"api_key": settings.openai_api_key}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url

        self._client = openai.OpenAI(**kwargs)
        self._model = settings.openai_model

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        force_json: bool = False,
    ) -> str:
        extra: dict = {}
        if force_json:
            extra["response_format"] = {"type": "json_object"}
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **extra,
            )
        except openai.APIStatusError as exc:
            raise LLMError(f"OpenAI API error ({exc.status_code}): {exc.message}") from exc
        except openai.APIConnectionError as exc:
            raise LLMError(f"OpenAI connection error: {exc}") from exc

        if not response.choices:
            raise LLMError("OpenAI response had no choices")
        content = response.choices[0].message.content
        if not content:
            raise LLMError("OpenAI response had empty content")

        logger.info(
            "OpenAI call: prompt=%s completion=%s",
            response.usage.prompt_tokens if response.usage else None,
            response.usage.completion_tokens if response.usage else None,
        )
        return content

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
            force_json=True,
        )
        return parse_storyboard(raw)
