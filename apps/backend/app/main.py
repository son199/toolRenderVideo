"""FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api import health, jobs, projects, uploads
from app.config import get_settings
from app.logging_config import configure_logging, get_logger


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    logger = get_logger("aividforge")

    app = FastAPI(
        title="AIVidForge API",
        version=__version__,
        description="AI tool to auto-generate short videos end-to-end.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(projects.router)
    app.include_router(uploads.router)
    app.include_router(jobs.http_router)
    app.include_router(jobs.ws_router)

    # Static mounts — Hyperframes templates and runtime storage (audio, output).
    # Single-user local Phase 1; revisit auth/scoping when multi-user lands.
    app.mount(
        "/static/hyperframes",
        StaticFiles(directory=settings.hyperframes_dir),
        name="hyperframes",
    )
    app.mount(
        "/static/storage",
        StaticFiles(directory=settings.storage_dir),
        name="storage",
    )

    @app.on_event("startup")
    def _startup() -> None:
        settings.ensure_dirs()
        logger.info(
            "AIVidForge backend started",
            version=__version__,
            llm_provider=settings.llm_provider,
            tts_provider=settings.tts_provider,
            storage_dir=str(settings.storage_dir),
        )

    return app


app = create_app()
