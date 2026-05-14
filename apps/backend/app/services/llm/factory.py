"""Resolve LLMProvider implementation from settings."""

from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.services.llm.base import LLMError, LLMProvider


@lru_cache(maxsize=3)
def get_provider(name: str | None = None) -> LLMProvider:
    """Return a cached LLMProvider for the given provider name (defaults to settings)."""
    provider = (name or get_settings().llm_provider).lower()

    if provider == "claude":
        from app.services.llm.claude_provider import ClaudeProvider

        return ClaudeProvider()
    if provider == "openai":
        from app.services.llm.openai_provider import OpenAIProvider

        return OpenAIProvider()
    if provider == "gemini":
        from app.services.llm.gemini_provider import GeminiProvider

        return GeminiProvider()

    raise LLMError(f"Unknown LLM provider: {provider}")
