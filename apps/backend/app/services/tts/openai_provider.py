"""OpenAI TTS provider (tts-1 / tts-1-hd). No word timings — Whisper fallback fills them."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import openai

from app.config import get_settings
from app.services.tts.base import TTSError, TTSProvider, TTSResult

logger = logging.getLogger(__name__)


class OpenAITTSProvider(TTSProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise TTSError("OPENAI_API_KEY is not set")
        kwargs: dict = {"api_key": settings.openai_api_key}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
        self._client = openai.OpenAI(**kwargs)
        self._model = "tts-1"

    @property
    def supports_word_timings(self) -> bool:
        return False

    async def synthesize(self, text: str, *, voice: str, out_path: Path) -> TTSResult:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # OpenAI TTS voices are short names (alloy, nova, shimmer, ...) — map common
        # Edge-TTS-style ids down to a reasonable default if needed.
        api_voice = voice if voice in _OPENAI_VOICES else "alloy"

        def _call() -> None:
            response = self._client.audio.speech.create(
                model=self._model,
                voice=api_voice,
                input=text,
                response_format="mp3",
            )
            response.stream_to_file(out_path)

        try:
            await asyncio.to_thread(_call)
        except openai.APIStatusError as exc:
            raise TTSError(f"OpenAI TTS error ({exc.status_code}): {exc.message}") from exc

        from app.services.tts.gtts_provider import _measure_duration

        duration = _measure_duration(out_path)
        logger.info("openai-tts: voice=%s duration=%.2fs", api_voice, duration)
        return TTSResult(audio_path=out_path, duration_sec=duration, word_timings=None)


_OPENAI_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
