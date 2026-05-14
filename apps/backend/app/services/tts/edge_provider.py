"""Edge-TTS provider — Microsoft Edge's free TTS. Returns native word timings.

WordBoundary events come in 100-nanosecond units (HNS); convert to seconds.
"""

from __future__ import annotations

import logging
from pathlib import Path

import edge_tts

from app.services.tts.base import TTSError, TTSProvider, TTSResult, WordTiming

logger = logging.getLogger(__name__)

HNS_PER_SECOND = 10_000_000


class EdgeTTSProvider(TTSProvider):
    @property
    def supports_word_timings(self) -> bool:
        return True

    async def synthesize(self, text: str, *, voice: str, out_path: Path) -> TTSResult:
        out_path.parent.mkdir(parents=True, exist_ok=True)

        word_timings: list[WordTiming] = []
        import asyncio
        
        last_error = None
        for attempt in range(3):
            try:
                word_timings.clear()
                communicate = edge_tts.Communicate(text, voice)
                with out_path.open("wb") as f:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            f.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            start = chunk["offset"] / HNS_PER_SECOND
                            end = start + chunk["duration"] / HNS_PER_SECOND
                            word_timings.append(WordTiming(chunk["text"], start, end))
                
                if out_path.stat().st_size > 0:
                    break # Success!
                else:
                    raise Exception("Empty audio file")
            except Exception as exc:
                last_error = exc
                await asyncio.sleep(1.0 * (attempt + 1))
        else:
            raise TTSError(f"Edge-TTS synthesis failed after 3 attempts: {last_error}")

        duration = word_timings[-1].end if word_timings else _estimate_duration(text)
        logger.info(
            "edge-tts: voice=%s words=%d duration=%.2fs path=%s",
            voice,
            len(word_timings),
            duration,
            out_path.name,
        )
        return TTSResult(
            audio_path=out_path,
            duration_sec=duration,
            word_timings=word_timings or None,
        )


def _estimate_duration(text: str) -> float:
    # Fallback heuristic for Vietnamese narration: ~15 chars/sec
    return max(2.0, len(text) / 15.0)
