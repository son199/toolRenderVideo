"""Rendering pipeline: Remotion Engine (React) renders directly to MP4."""

from app.services.render.remotion import render_remotion, RemotionError

# Re-exporting for compatibility with old names if needed, 
# but preferring render_remotion moving forward.
RenderError = RemotionError

__all__ = ["RenderError", "RemotionError", "render_remotion"]
