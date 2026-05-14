"""Shared agent base class + types.

All agents:
- Hold a reference to an ``LLMProvider`` (from ``services/llm``).
- Optionally receive a ``progress`` callable used to emit progress events
  upstream (typically wired to ``events.ProgressBus``).
- Call ``_complete()`` for raw text completions (runs in thread, non-blocking).
- Call ``_complete_with_retry()`` when JSON parsing may fail on first attempt.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC
from typing import Any, Awaitable, Callable

from app.services.llm.base import LLMError, LLMProvider

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, float, str], Any] | Callable[[str, float, str], Awaitable[None]]

# Default retry config — tune per-agent via _complete_with_retry kwargs.
_DEFAULT_RETRIES = 2
_DEFAULT_RETRY_DELAY = 1.0  # seconds between attempts


class AgentError(Exception):
    """Raised when an agent step fails (wraps LLM / parsing errors with context)."""

    def __init__(self, stage: str, message: str) -> None:
        super().__init__(f"[{stage}] {message}")
        self.stage = stage
        self.detail = message


class BaseAgent(ABC):
    """Common helpers for agent implementations."""

    stage_name: str = "agent"

    def __init__(self, provider: LLMProvider, progress: ProgressCallback | None = None) -> None:
        self._provider = provider
        self._progress = progress

    async def _emit(self, stage: str, progress: float, message: str = "") -> None:
        if self._progress is None:
            return
        result = self._progress(stage, progress, message)
        if asyncio.iscoroutine(result):
            await result

    async def _complete(self, *, system: str, user: str, max_tokens: int = 4096) -> str:
        """Off-load the (sync) LLM call to a worker thread so the loop stays free."""
        try:
            return await asyncio.to_thread(
                self._provider.complete,
                system=system,
                user=user,
                max_tokens=max_tokens,
            )
        except LLMError as exc:
            raise AgentError(self.stage_name, str(exc)) from exc

    async def _complete_with_retry(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
        retries: int = _DEFAULT_RETRIES,
        retry_delay: float = _DEFAULT_RETRY_DELAY,
    ) -> str:
        """Like ``_complete`` but retries on transient LLM / JSON errors.

        Useful for structured output calls where the model occasionally returns
        malformed JSON on the first attempt. Caps at ``retries`` extra attempts
        (total calls = retries + 1).

        Each retry appends a nudge to the user prompt asking for valid JSON,
        which empirically improves parse-success rate without changing system
        prompt token cost.
        """
        retry_suffix = "\n\nRESPOND ONLY WITH VALID JSON — no markdown fences, no prose."
        current_user = user

        for attempt in range(retries + 1):
            try:
                return await self._complete(
                    system=system, user=current_user, max_tokens=max_tokens
                )
            except AgentError as exc:
                if attempt == retries:
                    raise
                logger.warning(
                    "%s: attempt %d/%d failed (%s), retrying in %.1fs",
                    self.stage_name, attempt + 1, retries + 1, exc.detail, retry_delay,
                )
                await asyncio.sleep(retry_delay)
                # Add JSON nudge only on retry to avoid polluting the first attempt
                if retry_suffix not in current_user:
                    current_user = user + retry_suffix

        # Unreachable — loop always raises or returns, but keeps type-checker happy
        raise AgentError(self.stage_name, "retry loop exhausted")