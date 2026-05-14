"""Build SRT subtitle from per-scene word timings.

Whisper fallback is lazy-imported so `faster-whisper` (and its CTranslate2 dependency)
is only required when a provider lacks native word timings AND fallback is enabled.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.services.scene_text import narration_text
from app.services.tts.base import WordTiming

logger = logging.getLogger(__name__)

MAX_WORDS_PER_CHUNK = 7  # screen-friendly subtitle line length


def build_srt(scenes: list[dict[str, Any]]) -> str:
    """Concatenate per-scene word timings into one SRT, offsetting by cumulative time.

    Each scene dict must carry: `text` (fallback line), `duration_sec` (audio length),
    and optionally `word_timings` (list of {word, start, end}).
    """
    blocks: list[str] = []
    idx = 1
    cursor = 0.0

    for scene in scenes:
        duration = float(scene.get("duration_sec") or 0.0)
        timings = scene.get("word_timings")

        if timings:
            for chunk in _chunk_words(timings):
                start = cursor + chunk[0]["start"]
                end = cursor + chunk[-1]["end"]
                text = " ".join(w["word"] for w in chunk).strip()
                blocks.append(_format_block(idx, start, end, text))
                idx += 1
        else:
            # No timings — show the whole scene line for its duration. Prefer the
            # short English caption (subtitle band role); fall back to VI narration.
            caption = scene.get("caption") if isinstance(scene.get("caption"), dict) else None
            line = (caption or {}).get("en") or narration_text(scene)
            blocks.append(_format_block(idx, cursor, cursor + duration, line))
            idx += 1

        cursor += duration

    return "\n\n".join(blocks) + "\n"


def write_srt(scenes: list[dict[str, Any]], out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(build_srt(scenes), encoding="utf-8")
    return out_path


def whisper_align(audio_path: Path, language: str = "vi") -> list[WordTiming]:
    """Run faster-whisper on `audio_path` and return word-level timings.

    Imported lazily so faster-whisper is only required when this fallback fires.
    """
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is not installed. Install with: "
            "pip install faster-whisper"
        ) from exc

    from app.config import get_settings

    settings = get_settings()
    model = WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type="int8",
    )
    segments, _info = model.transcribe(
        str(audio_path),
        language=language,
        word_timestamps=True,
    )
    timings: list[WordTiming] = []
    for seg in segments:
        for w in seg.words or []:
            timings.append(WordTiming(word=w.word.strip(), start=float(w.start), end=float(w.end)))
    return timings


def timings_to_dict(timings: list[WordTiming]) -> list[dict[str, Any]]:
    return [asdict(t) for t in timings]


# ----- private helpers -----


def _chunk_words(timings: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    chunks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for w in timings:
        current.append(w)
        if len(current) >= MAX_WORDS_PER_CHUNK or w["word"].endswith((".", "?", "!", ",")):
            chunks.append(current)
            current = []
    if current:
        chunks.append(current)
    return chunks


def _format_block(idx: int, start: float, end: float, text: str) -> str:
    return f"{idx}\n{_format_time(start)} --> {_format_time(end)}\n{text}"


def _format_time(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms == 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
