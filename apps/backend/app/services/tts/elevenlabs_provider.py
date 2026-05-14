"""ElevenLabs provider — premium quality. Word timings via timestamps endpoint."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from elevenlabs.client import ElevenLabs

from app.config import get_settings
from app.services.tts.base import TTSError, TTSProvider, TTSResult, WordTiming

logger = logging.getLogger(__name__)


class ElevenLabsProvider(TTSProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.elevenlabs_api_key:
            raise TTSError("ELEVENLABS_API_KEY is not set")
        self._client = ElevenLabs(api_key=settings.elevenlabs_api_key)

    @property
    def supports_word_timings(self) -> bool:
        return True

    async def synthesize(self, text: str, *, voice: str, out_path: Path) -> TTSResult:
        out_path.parent.mkdir(parents=True, exist_ok=True)

        def _call() -> dict:
            # `voice` is an ElevenLabs voice_id. Returns audio + character-level timestamps.
            return self._client.text_to_speech.convert_with_timestamps(
                voice_id=voice,
                text=text,
                output_format="mp3_44100_128",
            )

        try:
            result = await asyncio.to_thread(_call)
        except Exception as exc:
            raise TTSError(f"ElevenLabs synthesis failed: {exc}") from exc

        import base64

        audio_b64 = result.get("audio_base64") or result.get("audio")
        if not audio_b64:
            raise TTSError("ElevenLabs response missing audio payload")
        out_path.write_bytes(base64.b64decode(audio_b64))

        timings = _character_to_word_timings(text, result.get("alignment"))
        duration = timings[-1].end if timings else _measure(out_path)
        logger.info("elevenlabs: voice=%s words=%d duration=%.2fs", voice, len(timings), duration)
        return TTSResult(audio_path=out_path, duration_sec=duration, word_timings=timings or None)


def _character_to_word_timings(text: str, alignment: dict | None) -> list[WordTiming]:
    if not alignment:
        return []
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    if not (len(chars) == len(starts) == len(ends)):
        return []

    words: list[WordTiming] = []
    buf: list[str] = []
    buf_start: float | None = None
    buf_end: float = 0.0
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if buf:
                words.append(WordTiming("".join(buf), buf_start or 0.0, buf_end))
                buf, buf_start = [], None
        else:
            if buf_start is None:
                buf_start = s
            buf.append(ch)
            buf_end = e
    if buf:
        words.append(WordTiming("".join(buf), buf_start or 0.0, buf_end))
    return words


def _measure(path: Path) -> float:
    from app.services.tts.gtts_provider import _measure_duration

    return _measure_duration(path)
