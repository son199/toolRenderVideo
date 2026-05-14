"""TTS adapter — pluggable providers behind a common async interface."""

from app.services.tts.factory import get_provider

__all__ = ["get_provider"]
