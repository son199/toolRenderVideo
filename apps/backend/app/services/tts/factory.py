"""Resolve TTSProvider implementation from settings."""

from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.services.tts.base import TTSError, TTSProvider


@lru_cache(maxsize=4)
def get_provider(name: str | None = None) -> TTSProvider:
    """Return a cached TTSProvider for the given provider name (defaults to settings)."""
    provider = (name or get_settings().tts_provider).lower()

    if provider == "edge":
        from app.services.tts.edge_provider import EdgeTTSProvider

        return EdgeTTSProvider()
    if provider == "gtts":
        from app.services.tts.gtts_provider import GTTSProvider

        return GTTSProvider()
    if provider == "openai":
        from app.services.tts.openai_provider import OpenAITTSProvider

        return OpenAITTSProvider()
    if provider == "elevenlabs":
        from app.services.tts.elevenlabs_provider import ElevenLabsProvider

        return ElevenLabsProvider()

    raise TTSError(f"Unknown TTS provider: {provider}")
