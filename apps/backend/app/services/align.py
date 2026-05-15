"""Forced-alignment backends — recover word-level timings when TTS provider doesn't.

Priority:
1. Groq STT (cloud Whisper, fastest + most accurate, free tier ~14k sec/day)
2. openai-whisper local (PyTorch — slow but stable on Windows)
3. faster-whisper local (offline, may segfault on some Windows/CPU combos)

Each backend returns a list of `WordTiming`. Callers (jobs.py) try them in order
above until one returns timings; otherwise they fall back to linear split in the
frontend (`useSceneTiming`).
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services.tts.base import WordTiming

logger = logging.getLogger(__name__)


def reseat_to_original(
    aligned: list[WordTiming],
    original_text: str,
    duration_sec: float,
) -> list[WordTiming]:
    """Keep audio anchors from a transcription, replace its (often-wrong) words
    with the ground-truth narration text.

    Whisper-family STT on Vietnamese mangles words badly ("chỉ với một router"
    → "chỉ vớ một rút tơ"). The TIMING info is still useful — Whisper correctly
    identifies the audio's active span. We discard the noisy transcription and
    redistribute the original `original_text` words evenly across that span.

    Returns `aligned` unchanged when `original_text` is empty.
    """
    words = (original_text or "").split()
    if not words:
        return aligned

    # Active audio span from Whisper. If alignment is empty, fall back to the
    # full audio duration.
    if aligned:
        span_start = max(0.0, float(aligned[0].start))
        span_end = max(span_start, float(aligned[-1].end))
    else:
        span_start = 0.0
        span_end = max(0.0, float(duration_sec))

    # Tiny safety margin — leave a small head/tail breath so caption doesn't pop
    # in/out exactly at audio bounds.
    if span_end <= span_start:
        span_end = span_start + max(0.1, float(duration_sec))

    n = len(words)
    per = (span_end - span_start) / n
    reseated: list[WordTiming] = []
    for i, w in enumerate(words):
        reseated.append(
            WordTiming(
                word=w,
                start=span_start + per * i,
                end=span_start + per * (i + 1),
            )
        )
    return reseated

# PyTorch's CPU inference is NOT thread-safe with a single model instance.
# When jobs.py runs 10 scene aligns in parallel via asyncio.to_thread(), they all
# race on the same shared model → segfault. This lock serializes transcribe calls.
_WHISPER_TRANSCRIBE_LOCK = threading.Lock()


def groq_align(audio_path: Path, language: str = "vi") -> list[WordTiming]:
    """Send audio to Groq's Whisper API and parse word-level timestamps.

    Uses OpenAI SDK pointed at the Groq base URL — Groq's STT is OpenAI-compatible.
    Returns [] silently when GROQ_API_KEY is unset so callers can chain fallbacks.
    """
    from app.config import get_settings

    settings = get_settings()
    if not settings.groq_api_key:
        return []

    try:
        import openai  # type: ignore
    except ImportError as exc:
        raise RuntimeError("openai SDK not installed") from exc

    client = openai.OpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
    )

    with audio_path.open("rb") as f:
        resp = client.audio.transcriptions.create(
            model=settings.groq_stt_model,
            file=f,
            language=language,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    words = getattr(resp, "words", None) or []
    timings: list[WordTiming] = []
    for w in words:
        # Word objects come back as dicts or pydantic models depending on SDK
        word = getattr(w, "word", None) or (w.get("word") if isinstance(w, dict) else "")
        start = getattr(w, "start", None) or (w.get("start") if isinstance(w, dict) else 0.0)
        end = getattr(w, "end", None) or (w.get("end") if isinstance(w, dict) else 0.0)
        if word and isinstance(word, str):
            timings.append(WordTiming(word=word.strip(), start=float(start), end=float(end)))

    logger.info(
        "groq_align: model=%s words=%d audio=%s",
        settings.groq_stt_model,
        len(timings),
        audio_path.name,
    )
    return timings


@lru_cache(maxsize=1)
def _load_openai_whisper(model_size: str) -> Any:
    """Lazy-load openai-whisper model once per process."""
    import whisper  # type: ignore

    return whisper.load_model(model_size)


def openai_whisper_align(audio_path: Path, language: str = "vi") -> list[WordTiming]:
    """Run the original openai-whisper (PyTorch) and return word-level timings.

    Pure-Python via PyTorch — slower than faster-whisper but doesn't segfault on
    Windows/CPU combos where ctranslate2's native binary fails.
    """
    try:
        import whisper  # type: ignore  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "openai-whisper is not installed. Install with: pip install openai-whisper"
        ) from exc

    from app.config import get_settings

    settings = get_settings()
    model = _load_openai_whisper(settings.whisper_model)

    # Serialize: PyTorch CPU inference on a shared model is not thread-safe.
    with _WHISPER_TRANSCRIBE_LOCK:
        result = model.transcribe(
            str(audio_path),
            language=language,
            word_timestamps=True,
            verbose=False,
        )

    timings: list[WordTiming] = []
    for seg in result.get("segments") or []:
        for w in seg.get("words") or []:
            word = (w.get("word") or "").strip()
            if not word:
                continue
            timings.append(
                WordTiming(
                    word=word,
                    start=float(w.get("start") or 0.0),
                    end=float(w.get("end") or 0.0),
                )
            )

    logger.info(
        "openai_whisper_align: model=%s words=%d audio=%s",
        settings.whisper_model,
        len(timings),
        audio_path.name,
    )
    return timings
