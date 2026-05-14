"""Background job kickoff + WebSocket progress stream.

POST /projects/{id}/run    enqueues the full pipeline as an asyncio task
GET  /projects/{id}/events returns the replay buffer (HTTP polling fallback)
WS   /ws/projects/{id}/events streams live + replay progress events
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app import repository
from app.events import get_bus
from app.services.jobs import enqueue_full_pipeline

logger = logging.getLogger(__name__)

# HTTP router for /projects/{id}/run + replay; shares prefix with projects router.
http_router = APIRouter(prefix="/projects", tags=["jobs"])

# WebSocket router under /ws so the Vite dev proxy's ws rule catches it.
ws_router = APIRouter(prefix="/ws", tags=["jobs"])

_PROJECT_NOT_FOUND = "Project not found"


@http_router.post(
    "/{project_id}/run",
    status_code=status.HTTP_202_ACCEPTED,
    responses={404: {"description": _PROJECT_NOT_FOUND}},
)
async def run_pipeline(project_id: uuid.UUID) -> dict[str, str]:
    """Kick off the full ingest→storyboard→tts→render pipeline in the background.

    Returns immediately with a ``job_id``; subscribe to ``/ws/projects/{id}/events``
    for live progress.
    """
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    job_id = enqueue_full_pipeline(project_id)
    return {"job_id": job_id, "project_id": str(project_id), "status": "queued"}


@http_router.get(
    "/{project_id}/events",
    responses={404: {"description": _PROJECT_NOT_FOUND}},
)
async def list_events(project_id: uuid.UUID) -> list[dict]:
    """Replay buffer of progress events for this project (polling fallback)."""
    if repository.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail=_PROJECT_NOT_FOUND)
    return [e.to_dict() for e in get_bus().replay(str(project_id))]


@ws_router.websocket("/projects/{project_id}/events")
async def stream_events(ws: WebSocket, project_id: uuid.UUID) -> None:
    """Stream progress events for ``project_id``. Closes after a terminal event."""
    await ws.accept()
    bus = get_bus()
    try:
        async for event in bus.subscribe(str(project_id)):
            await ws.send_json(event.to_dict())
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("WS error for %s", project_id)
        try:
            await ws.send_json({"stage": "error", "message": str(exc), "progress": 1.0})
        except Exception:  # noqa: BLE001
            pass
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass
