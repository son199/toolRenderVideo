"""Drive Hyperframes templates with Playwright and record a WebM video.

Strategy: launch headless Chromium at the target aspect ratio, inject the
storyboard + audio_meta via ``add_init_script`` (so the runner picks them up
before any template script runs), navigate to the template's ``index.html``
served by FastAPI, and wait for the runner to flip ``window.__HYPERFRAMES_DONE__``.
Closing the browser context flushes Playwright's recorded WebM to disk.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeoutError, async_playwright

from app.config import get_settings

logger = logging.getLogger(__name__)


class RenderError(Exception):
    """Raised when Playwright fails to produce a video."""


@dataclass
class RenderResult:
    webm_path: Path
    duration_sec: float
    width: int
    height: int


async def record_template(
    *,
    template: str,
    storyboard: dict[str, Any],
    audio_meta: list[dict[str, Any]],
    aspect_ratio: str,
    out_dir: Path,
    base_url: str | None = None,
) -> RenderResult:
    """Open the template page, wait for the GSAP timeline to finish, return the recorded WebM.

    Parameters
    ----------
    template: template id matching ``packages/hyperframes/templates/<id>``.
    storyboard: storyboard dict (the one stored on the project).
    audio_meta: list aligned to ``storyboard.scenes`` carrying per-scene
        ``duration_sec`` (and optional ``audio_url`` ignored in record mode).
    aspect_ratio: "9:16" or "16:9".
    out_dir: directory to receive ``raw.webm``. Must be writable.
    base_url: backend origin where ``/static/hyperframes`` is served.
    """
    settings = get_settings()
    base_url = base_url or f"http://127.0.0.1:{settings.backend_port}"

    if aspect_ratio == "9:16":
        width, height = settings.render_width_portrait, settings.render_height_portrait
    elif aspect_ratio == "16:9":
        width, height = settings.render_width_landscape, settings.render_height_landscape
    else:
        raise RenderError(f"Unsupported aspect_ratio: {aspect_ratio}")

    out_dir.mkdir(parents=True, exist_ok=True)
    template_url = f"{base_url}/static/hyperframes/templates/{template}/index.html"

    # Slightly trim audio_meta of fields that aren't needed in the browser; keep
    # duration so GSAP timeline length matches actual audio.
    minimal_meta = [
        {
            "scene_id": m.get("scene_id"),
            "audio_url": None,  # record mode skips audio playback
            "duration_sec": m.get("duration_sec"),
            "word_timings": m.get("word_timings"),
        }
        for m in audio_meta
    ]

    init_script = (
        f"window.__STORYBOARD__ = {json.dumps(storyboard)};\n"
        f"window.__AUDIO_META__ = {json.dumps(minimal_meta)};\n"
        f"window.__RENDER_MODE__ = \"record\";\n"
    )

    expected_duration = sum(float(m.get("duration_sec") or 0) for m in minimal_meta) or 30.0
    wait_timeout_ms = int((expected_duration + 30.0) * 1000)

    async with async_playwright() as pw:
        try:
            browser = await pw.chromium.launch(
                headless=settings.playwright_headless,
                args=[
                    "--autoplay-policy=no-user-gesture-required",
                    "--enable-gpu",
                    "--use-gl=egl",
                    "--ignore-gpu-blocklist",
                    "--disable-software-rasterizer",
                    "--enable-webgl",
                    "--disable-dev-shm-usage"
                ],
            )
        except Exception as exc:
            raise RenderError(f"Failed to launch chromium: {exc}") from exc

        try:
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                record_video_dir=str(out_dir),
                record_video_size={"width": width, "height": height},
            )
            await context.add_init_script(init_script)

            page = await context.new_page()
            try:
                await page.goto(template_url, wait_until="load", timeout=30_000)
            except PlaywrightTimeoutError as exc:
                raise RenderError(f"Could not load template page: {template_url}") from exc

            # Surface template errors immediately rather than waiting for the
            # done flag to time out.
            error_flag = await page.evaluate("window.__HYPERFRAMES_ERROR__ || null")
            if error_flag:
                raise RenderError(f"Template reported error before start: {error_flag}")

            try:
                await page.wait_for_function(
                    "window.__HYPERFRAMES_DONE__ === true || window.__HYPERFRAMES_ERROR__",
                    timeout=wait_timeout_ms,
                )
            except PlaywrightTimeoutError as exc:
                raise RenderError(
                    f"Timeline did not finish within {wait_timeout_ms}ms"
                ) from exc

            error_flag = await page.evaluate("window.__HYPERFRAMES_ERROR__ || null")
            if error_flag:
                raise RenderError(f"Template runner error: {error_flag}")

            video_obj = page.video
            await context.close()  # closes context so video file is finalised

            if video_obj is None:
                raise RenderError("Playwright did not attach a video to the page")

            saved_path = await video_obj.path()
            target_path = out_dir / "raw.webm"
            saved = Path(saved_path)
            if saved != target_path:
                if target_path.exists():
                    target_path.unlink()
                saved.rename(target_path)

            logger.info(
                "playwright recorded: %s (%dx%d, expected %.1fs)",
                target_path,
                width,
                height,
                expected_duration,
            )
            return RenderResult(
                webm_path=target_path,
                duration_sec=expected_duration,
                width=width,
                height=height,
            )
        finally:
            await browser.close()
