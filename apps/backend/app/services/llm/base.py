"""LLM provider interface.

Two layers:

- ``complete(system, user, max_tokens)`` — low-level: pass any system + user prompt
  to the underlying model and get raw text back. Agents call this directly so
  they can run their own prompt chains (analyze, review, refine, ...).
- ``generate_storyboard(...)`` — high-level helper that composes the Phase 1
  storyboard prompt and parses the JSON. Implemented on top of ``complete()``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.storyboard import Storyboard


class LLMError(Exception):
    """Raised when the LLM call or output parsing fails."""


class LLMProvider(ABC):
    """Pluggable LLM backend (Claude / OpenAI / Gemini)."""

    @abstractmethod
    def complete(self, *, system: str, user: str, max_tokens: int = 4096) -> str:
        """Run a single LLM completion. Returns the raw model text.

        Raises ``LLMError`` on API failure. Caller is responsible for parsing.
        """

    @abstractmethod
    def generate_storyboard(
        self,
        text: str,
        *,
        template: str,
        aspect_ratio: str,
        voice: str | None,
    ) -> Storyboard:
        """Synthesize a storyboard from ``text``. Raises ``LLMError`` on failure."""
