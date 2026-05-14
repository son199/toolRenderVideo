"""Gemini provider — basic implementation using google-generativeai.

The package is deprecated upstream (google-genai is the successor); we keep this
provider minimal until we genuinely need it.
"""

from __future__ import annotations

import logging

import google.generativeai as genai

from app.config import get_settings
from app.schemas.storyboard import Storyboard
from app.services.llm._json import parse_storyboard
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.prompts import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.google_api_key:
            raise LLMError("GOOGLE_API_KEY is not set")
        genai.configure(api_key=settings.google_api_key)
        self._model_name = settings.gemini_model

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        force_json: bool = False,
    ) -> str:
        model = genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=system,
        )
        config: dict = {"max_output_tokens": max_tokens}
        if force_json:
            config["response_mime_type"] = "application/json"
        try:
            response = model.generate_content(user, generation_config=config)
        except Exception as exc:  # noqa: BLE001
            raise LLMError(f"Gemini error: {exc}") from exc
        if not response.text:
            raise LLMError("Gemini response was empty")
        logger.info("Gemini call completed")
        return response.text

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
