"""Project CRUD + ingest + storyboard endpoints. File-based JSON repository."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app import repository
from app.config import get_settings
from app.schemas.project import Project, ProjectCreate, ProjectUpdate
from app.services.ingest import IngestError, ingest
from app.services.llm import get_provider as get_llm_provider
from app.services.llm.base import LLMError
from app.services.render import RemotionError, render_remotion
from app.services.scene_text import narration_text
from app.services.subtitle import timings_to_dict, whisper_align, write_srt
from app.services.tts import get_provider as get_tts_provider
from app.services.tts.base import TTSError

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

_PROJECT_NOT_FOUND = "Project not found"
_NOT_FOUND = {404: {"description": _PROJECT_NOT_FOUND}}
_VALIDATION = {422: {"description": "Invalid input payload"}}
_LLM_FAILED = {502: {"description": "LLM provider failed"}}


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses=_VALIDATION,
)
def create_project(payload: ProjectCreate) -> Project:
    """Create a project and run ingest synchronously.

    On success the project is persisted with `raw_text` populated and
    `status == "ingested"`. Storyboard generation is a separate call.
    """
    if payload.input_type in ("text", "url") and not payload.input_value:
        raise HTTPException(
            status_code=422,
            detail=f"input_value required for input_type={payload.input_type}",
        )
    if payload.input_type == "file" and not payload.upload_path:
        raise HTTPException(status_code=422, detail="upload_path required for input_type=file")

    project = repository.create_project(payload)

    try:
        raw_text = ingest(project)
    except IngestError as exc:
        logger.warning("Ingest failed for %s: %s", project.id, exc)
        updated = repository.update_project(
            project.id, {"status": "failed", "error": f"Ingest failed: {exc}"}
        )
        return updated or project

    updated = repository.update_project(
        project.id,
        {"raw_text": raw_text, "status": "ingested", "error": None},
    )
    return updated or project


@router.get("")
def list_projects(limit: int = 50, offset: int = 0) -> list[Project]:
    return repository.list_projects(limit=min(limit, 200), offset=offset)


@router.get("/{project_id}", responses=_NOT_FOUND)
def get_project(project_id: uuid.UUID) -> Project:
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    return project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_NOT_FOUND,
)
def delete_project(project_id: uuid.UUID) -> None:
    if not repository.delete_project(project_id):
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)


@router.post(
    "/{project_id}/storyboard",
    responses={**_NOT_FOUND, **_VALIDATION, **_LLM_FAILED},
)
def generate_storyboard(project_id: uuid.UUID) -> Project:
    """Run the configured LLM provider on the project's raw_text."""
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    if not project.raw_text:
        raise HTTPException(
            status_code=422,
            detail="Project has no raw_text — re-run create or check ingest error",
        )

    provider = get_llm_provider()
    try:
        storyboard = provider.generate_storyboard(
            project.raw_text,
            template=project.template,
            aspect_ratio=project.aspect_ratio,
            voice=project.voice,
        )
    except LLMError as exc:
        logger.warning("LLM failed for %s: %s", project.id, exc)
        updated = repository.update_project(
            project.id, {"status": "failed", "error": f"LLM failed: {exc}"}
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Đảm bảo storyboard là Pydantic model, nếu không thì convert về dict
    if hasattr(storyboard, "model_dump"):
        sb_dict = storyboard.model_dump(mode="json")
    elif hasattr(storyboard, "dict"):
        sb_dict = storyboard.dict()
    else:
        sb_dict = dict(storyboard)

    updated = repository.update_project(
        project.id,
        {
            "storyboard": sb_dict,
            "status": "storyboard_ready",
            "error": None,
        },
    )
    return updated or project


@router.post(
    "/{project_id}/tts",
    responses={**_NOT_FOUND, **_VALIDATION, 502: {"description": "TTS provider failed"}},
)
async def generate_tts(project_id: uuid.UUID, use_whisper_fallback: bool = False) -> Project:
    """Run the configured TTS provider on every scene of the project's storyboard.

    Writes one MP3 per scene under ``storage/audio/<project_id>/scene_NN.mp3`` plus
    a single ``subtitle.srt`` covering the whole video. If the TTS provider doesn't
    return word timings and ``use_whisper_fallback=true``, runs faster-whisper to
    fill them in (faster-whisper must be pip-installed).
    """
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    if not project.storyboard or not project.storyboard.get("scenes"):
        raise HTTPException(
            status_code=422, detail="Project has no storyboard — run /storyboard first"
        )

    settings = get_settings()
    provider = get_tts_provider()
    out_dir = settings.storage_audio / str(project.id)
    out_dir.mkdir(parents=True, exist_ok=True)

    updated_scenes: list[dict] = []
    try:
        for scene in project.storyboard["scenes"]:
            scene_id = int(scene["id"])
            scene_voice = scene.get("voice") or project.voice or settings.tts_default_voice
            audio_path = out_dir / f"scene_{scene_id:02d}.mp3"

            tts_text = narration_text(scene)
            if not tts_text:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Scene {scene_id} has no narration text "
                        "(missing caption.vi and type-specific body fields)"
                    ),
                )

            result = await provider.synthesize(
                text=tts_text, voice=scene_voice, out_path=audio_path
            )

            word_timings = result.word_timings
            if word_timings is None and use_whisper_fallback:
                try:
                    word_timings = whisper_align(result.audio_path, settings.whisper_language)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Whisper fallback failed for scene %s: %s", scene_id, exc)
                    word_timings = None

            updated_scenes.append(
                {
                    **scene,
                    "audio_path": str(result.audio_path),
                    "duration_sec": result.duration_sec,
                    "word_timings": (
                        timings_to_dict(word_timings) if word_timings is not None else None
                    ),
                }
            )
    except TTSError as exc:
        logger.warning("TTS failed for %s: %s", project.id, exc)
        repository.update_project(
            project.id, {"status": "failed", "error": f"TTS failed: {exc}"}
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    srt_path = write_srt(updated_scenes, out_dir / "subtitle.srt")

    updated = repository.update_project(
        project.id,
        {
            "scenes": updated_scenes,
            "subtitle_path": str(srt_path),
            "status": "tts_ready",
            "error": None,
        },
    )
    return updated or project


@router.post(
    "/{project_id}/render",
    responses={
        **_NOT_FOUND,
        **_VALIDATION,
        500: {"description": "Remotion render failed"},
    },
)
async def render_video(project_id: uuid.UUID) -> Project:
    """Render video directly via Remotion Engine.

    Pre-requirements (returns 422 if missing):
    - project.storyboard populated
    - project.scenes[].audio_path populated (run /tts first)
    """
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    if not project.storyboard:
        raise HTTPException(status_code=422, detail="Project has no storyboard")
    if not project.scenes or not all(s.get("audio_path") for s in project.scenes):
        raise HTTPException(
            status_code=422,
            detail="Project has no per-scene audio — run /tts first",
        )

    settings = get_settings()
    output_dir = settings.storage_output
    output_path = output_dir / f"{project.id}.mp4"

    repository.update_project(project.id, {"status": "rendering", "error": None})

    # Refresh scenes after status write so the runner sees the canonical record.
    project = repository.get_project(project_id) or project

    try:
        await render_remotion(
            project_id=str(project.id),
            scenes=project.scenes,
            template=project.template,
            output_path=output_path,
        )
    except RemotionError as exc:
        logger.exception("Render failed for %s", project.id)
        repository.update_project(
            project.id, {"status": "failed", "error": f"Render failed: {exc}"}
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    updated = repository.update_project(
        project.id,
        {
            "output_path": str(output_path),
            "status": "completed",
            "error": None,
        },
    )
    return updated or project


# ============================================================
# Edit + reset endpoints (Phase 2H)
# ============================================================


@router.patch(
    "/{project_id}",
    responses={**_NOT_FOUND, **_VALIDATION},
)
def update_project(project_id: uuid.UUID, payload: ProjectUpdate) -> Project:
    """Partial update — only fields explicitly set in the body are touched.

    Editable fields: title, input_type, input_value, upload_path, template,
    aspect_ratio, voice, use_agent, burn_subtitle. Derived data (raw_text,
    storyboard, scenes, output_path, status, error) is NOT touched — use
    ``/reset`` to clear those before re-running the pipeline.

    Changing ``input_value`` / ``input_type`` / ``upload_path`` does NOT
    automatically re-ingest; caller should hit ``/reset`` then ``/run`` if they
    want the pipeline to re-process the new input.
    """
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)

    # exclude_unset preserves "field not in body → don't touch existing value"
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        return project

    updated = repository.update_project(project_id, patch)
    return updated or project


@router.post(
    "/{project_id}/reset",
    responses={**_NOT_FOUND},
)
def reset_project(project_id: uuid.UUID) -> Project:
    """Clear all derived pipeline data so the project can be re-run from scratch.

    Resets: raw_text, storyboard, scenes (incl. per-scene audio_path +
    word_timings), subtitle_path, output_path, error, status → ``draft``.

    Preserves: id, title, input_type, input_value, upload_path, template,
    aspect_ratio, voice, use_agent, burn_subtitle, created_at, user_id.

    Audio/output files on disk are NOT deleted — they'll be overwritten when
    the pipeline re-runs. (Use DELETE /projects/{id} for full cleanup.)
    """
    project = repository.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)

    updated = repository.update_project(
        project_id,
        {
            "raw_text": None,
            "storyboard": None,
            "scenes": [],
            "subtitle_path": None,
            "output_path": None,
            "error": None,
            "status": "draft",
        },
    )
    logger.info("project %s reset to draft", project_id)
    return updated or project
