"""TTS provider interface and shared types."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


class TTSError(Exception):
    """Raised when synthesis fails — surfaced as 502 to the API caller."""


@dataclass
class WordTiming:
    word: str
    start: float  # seconds, relative to scene audio start
    end: float


@dataclass
class TTSResult:
    audio_path: Path
    duration_sec: float
    word_timings: list[WordTiming] | None  # None if provider has no native timing


class TTSProvider(ABC):
    """All providers write an MP3 file and optionally return word boundaries."""

    @property
    @abstractmethod
    def supports_word_timings(self) -> bool: ...

    @abstractmethod
    async def synthesize(self, text: str, *, voice: str, out_path: Path) -> TTSResult:
        """Synthesize `text` to `out_path` using `voice`. Raises TTSError on failure."""
