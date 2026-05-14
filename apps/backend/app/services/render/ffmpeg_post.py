"""FFmpeg post-processing: concat per-scene audio, mux onto WebM, burn SRT, re-encode to MP4."""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class FFmpegError(Exception):
    """Raised when an ffmpeg subprocess returns non-zero."""


def assemble_final_video(
    *,
    raw_video: Path,
    audio_files: list[Path],
    srt_path: Path | None,
    out_path: Path,
    burn_subtitle: bool = True,
    cleanup_raw_video: bool = True,
) -> Path:
    """Concat audio → mux onto recorded video → optionally burn SRT → MP4 H.264.

    Parameters
    ----------
    raw_video: WebM produced by Playwright.
    audio_files: per-scene MP3s in playback order.
    srt_path: SRT file produced by ``services.subtitle.write_srt`` (or None to skip subs).
    out_path: target MP4 path.
    burn_subtitle: hard-burn the SRT into the video. When False the SRT can still
        be exported separately as a sidecar file.
    cleanup_raw_video: when True (default), delete the WebM after the MP4 is
        written successfully. Keeps disk usage bounded — the MP4 supersedes it.
    """
    _require_binary("ffmpeg")
    if not raw_video.exists():
        raise FFmpegError(f"Raw video not found: {raw_video}")
    if not audio_files:
        raise FFmpegError("At least one audio file required for muxing")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    work = out_path.parent / "_work"
    work.mkdir(parents=True, exist_ok=True)

    try:
        concat_audio = _concat_audio(audio_files, work)
        _encode(
            raw_video=raw_video,
            audio=concat_audio,
            srt_path=srt_path if burn_subtitle else None,
            out_path=out_path,
        )
    finally:
        shutil.rmtree(work, ignore_errors=True)

    if cleanup_raw_video and out_path.exists():
        try:
            raw_video.unlink(missing_ok=True)
            # If the parent frames dir is now empty, remove it too.
            parent = raw_video.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
        except OSError as exc:
            logger.warning("Failed to clean up raw video %s: %s", raw_video, exc)

    return out_path


# ----- private helpers -----


def _concat_audio(audio_files: list[Path], work_dir: Path) -> Path:
    """Concatenate the per-scene MP3s into a single AAC track for muxing.

    Uses ffmpeg's concat demuxer for inputs that share codec (mp3, mp3, ...).
    """
    list_file = work_dir / "audio_list.txt"
    # ffmpeg concat demuxer needs forward-slashed absolute paths quoted.
    lines = [f"file '{a.resolve().as_posix()}'" for a in audio_files]
    list_file.write_text("\n".join(lines), encoding="utf-8")

    concat_path = work_dir / "audio.m4a"
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(concat_path),
    ]
    _run(cmd, "audio concat")
    return concat_path


def _encode(
    *,
    raw_video: Path,
    audio: Path,
    srt_path: Path | None,
    out_path: Path,
) -> None:
    """Final encode: H.264 video + AAC audio, optional burned SRT, loudnorm filter."""
    vfilters: list[str] = []
    if srt_path is not None:
        # The subtitles filter parses argument with its own escaping. On Windows
        # ffmpeg needs forward-slashed paths with the drive letter colon escaped.
        srt_arg = str(srt_path.resolve()).replace("\\", "/")
        srt_arg = srt_arg.replace(":", "\\:")
        force_style = "FontSize=18,MarginV=40,Bold=0,Outline=1.5,Shadow=0.5,Alignment=2"
        vfilters.append(f"subtitles='{srt_arg}':force_style='{force_style}'")

    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(raw_video),
        "-i",
        str(audio),
    ]
    if vfilters:
        cmd += ["-vf", ",".join(vfilters)]

    cmd += [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "-movflags",
        "+faststart",
        str(out_path),
    ]
    _run(cmd, "final encode")


def _run(cmd: list[str], stage: str) -> None:
    logger.info("ffmpeg [%s]: %s", stage, " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise FFmpegError(
            f"ffmpeg {stage} failed (exit {proc.returncode}):\n{proc.stderr.strip()}"
        )


def _require_binary(name: str) -> None:
    if shutil.which(name) is None:
        raise FFmpegError(
            f"`{name}` not found in PATH. Install FFmpeg (e.g. `winget install Gyan.FFmpeg`)."
        )
