"""Application settings loaded from environment / .env file."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Redirect Playwright's browser cache to a non-system-drive location when the
# folder exists, so re-installs / multi-machine setups don't blow up C:.
_PW_CACHE = Path("E:/playwright-browsers")
if _PW_CACHE.exists():
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(_PW_CACHE))

# On Windows, Python's default SSL context doesn't read the system certificate store —
# edge-tts (aiohttp) fails with "certificate verify failed". `truststore.inject_into_ssl`
# patches ssl.create_default_context to use the OS trust store, fixing every async/HTTP
# library transparently. Falls back to certifi env vars if truststore isn't installed.
try:
    import truststore  # type: ignore

    truststore.inject_into_ssl()
except ImportError:
    try:
        import certifi as _certifi  # type: ignore

        os.environ.setdefault("SSL_CERT_FILE", _certifi.where())
        os.environ.setdefault("REQUESTS_CA_BUNDLE", _certifi.where())
    except ImportError:
        pass

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[REPO_ROOT / ".env", Path(".env")],
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_origin: str = "http://localhost:5173"

    # Storage (file-based for Phase 1; Postgres comes later)
    storage_dir: Path = REPO_ROOT / "storage"

    # LLM
    llm_provider: Literal["openai", "claude", "gemini"] = "claude"

    # OpenAI
    openai_api_key: str = ""
    openai_base_url: str = ""  # leave blank for official api.openai.com
    openai_model: str = "gpt-4.1"

    # Anthropic / Claude (supports custom gateway via ANTHROPIC_BASE_URL)
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""  # leave blank for official api.anthropic.com
    anthropic_model: str = "claude-sonnet-4-5"

    # Google Gemini
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    @property
    def llm_model(self) -> str:
        """Resolve the model name for the currently selected LLM provider."""
        if self.llm_provider == "openai":
            return self.openai_model
        if self.llm_provider == "claude":
            return self.anthropic_model
        return self.gemini_model

    # TTS
    tts_provider: Literal["edge", "gtts", "elevenlabs", "openai"] = "edge"
    tts_default_voice: str = "vi-VN-HoaiMyNeural"
    elevenlabs_api_key: str = ""

    # Whisper fallback
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_language: str = "vi"

    # Remotion config
    remotion_dir: Path = REPO_ROOT / "packages" / "remotion-engine"
    render_fps: int = 30

    # Logging
    log_level: str = "INFO"
    log_json: bool = False

    @property
    def storage_audio(self) -> Path:
        return self.storage_dir / "audio"

    @property
    def storage_frames(self) -> Path:
        return self.storage_dir / "frames"

    @property
    def storage_output(self) -> Path:
        return self.storage_dir / "output"

    @property
    def storage_uploads(self) -> Path:
        return self.storage_dir / "uploads"

    @property
    def storage_projects(self) -> Path:
        return self.storage_dir / "projects"

    def ensure_dirs(self) -> None:
        for p in (
            self.storage_audio,
            self.storage_frames,
            self.storage_output,
            self.storage_uploads,
            self.storage_projects,
        ):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
