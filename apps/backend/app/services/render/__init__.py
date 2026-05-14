"""Rendering pipeline: Playwright records HTML+GSAP, FFmpeg muxes audio & subtitle."""

from app.services.render.playwright_recorder import RenderError, record_template
from app.services.render.ffmpeg_post import assemble_final_video

__all__ = ["RenderError", "record_template", "assemble_final_video"]
