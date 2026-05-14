"""File-based JSON repository for projects.

Phase 1 simplification: skip Postgres while the project is small. Each project is
a single JSON file under ``<storage_dir>/projects/<id>.json``. Schema and field
names mirror the eventual SQLAlchemy model so swapping back is mechanical.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.schemas.project import Project, ProjectCreate

_settings = get_settings()
PROJECTS_DIR: Path = _settings.storage_dir / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def _path(project_id: uuid.UUID | str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_projects(*, limit: int = 50, offset: int = 0) -> list[Project]:
    files = sorted(
        PROJECTS_DIR.glob("*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return [_load(p) for p in files[offset : offset + limit]]


def get_project(project_id: uuid.UUID | str) -> Project | None:
    path = _path(project_id)
    if not path.exists():
        return None
    return _load(path)


def create_project(payload: ProjectCreate) -> Project:
    project_id = uuid.uuid4()
    now = _now()
    project = Project(
        id=project_id,
        title=payload.title or "Untitled",
        input_type=payload.input_type,
        input_value=payload.input_value,
        upload_path=payload.upload_path,
        template=payload.template,
        aspect_ratio=payload.aspect_ratio,
        voice=payload.voice,
        use_agent=payload.use_agent,
        burn_subtitle=payload.burn_subtitle,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    _save(project)
    return project


def update_project(project_id: uuid.UUID | str, patch: dict[str, Any]) -> Project | None:
    existing = get_project(project_id)
    if existing is None:
        return None
    data = existing.model_dump(mode="json")
    data.update(patch)
    data["updated_at"] = _now().isoformat()
    updated = Project.model_validate(data)
    _save(updated)
    return updated


def delete_project(project_id: uuid.UUID | str) -> bool:
    path = _path(project_id)
    if not path.exists():
        return False
    path.unlink()
    return True


def _save(project: Project) -> None:
    _path(project.id).write_text(
        project.model_dump_json(indent=2),
        encoding="utf-8",
    )


def _load(path: Path) -> Project:
    return Project.model_validate_json(path.read_text(encoding="utf-8"))
