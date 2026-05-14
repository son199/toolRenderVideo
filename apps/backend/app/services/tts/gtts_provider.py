"""gTTS provider — Google Translate TTS. No native word timings; Whisper fallback fills them."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from gtts import gTTS

from app.services.tts.base import TTSError, TTSProvider, TTSResult

logger = logging.getLogger(__name__)


class GTTSProvider(TTSProvider):
    @property
    def supports_word_timings(self) -> bool:
        return False

    async def synthesize(self, text: str, *, voice: str, out_path: Path) -> TTSResult:
        """`voice` for gTTS is the language code (e.g. "vi", "en")."""
        out_path.parent.mkdir(parents=True, exist_ok=True)
        lang = _voice_to_lang(voice)

        def _save() -> None:
            gTTS(text=text, lang=lang).save(str(out_path))

        try:
            await asyncio.to_thread(_save)
        except Exception as exc:
            raise TTSError(f"gTTS synthesis failed: {exc}") from exc

        duration = _measure_duration(out_path)
        logger.info("gtts: lang=%s duration=%.2fs path=%s", lang, duration, out_path.name)
        return TTSResult(audio_path=out_path, duration_sec=duration, word_timings=None)


def _voice_to_lang(voice: str) -> str:
    """Edge-TTS voice ids like 'vi-VN-HoaiMyNeural' → 'vi'. Already-short codes pass through."""
    if "-" in voice:
        return voice.split("-", 1)[0].lower()
    return voice.lower()


def _measure_duration(path: Path) -> float:
    try:
        from mutagen.mp3 import MP3

        return float(MP3(str(path)).info.length)
    except Exception:
        return max(2.0, path.stat().st_size / 16000)  # crude bitrate-based fallback
