"""Project I/O schemas. Storage is file-based (JSON) for now — no ORM."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ProjectStatus = Literal[
    "draft",
    "ingested",
    "storyboard_ready",
    "tts_ready",
    "rendering",
    "completed",
    "failed",
]


class ProjectCreate(BaseModel):
    title: str = Field(default="Untitled", max_length=255)
    input_type: Literal["text", "url", "file"]
    input_value: str | None = None
    upload_path: str | None = None
    template: str = "news"
    aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    voice: str | None = None
    use_agent: bool = False
    burn_subtitle: bool = True


class ProjectUpdate(BaseModel):
    """Partial update for an existing project — all fields optional.

    Fields NOT included (and therefore not editable via this path):
      - id, user_id, created_at, updated_at  : identity/audit
      - raw_text, storyboard, scenes, ...    : derived data (use /reset to clear)
      - status, error                        : managed by pipeline state machine
    """

    title: str | None = Field(default=None, max_length=255)
    input_type: Literal["text", "url", "file"] | None = None
    input_value: str | None = None
    upload_path: str | None = None
    template: str | None = None
    aspect_ratio: Literal["9:16", "16:9"] | None = None
    voice: str | None = None
    use_agent: bool | None = None
    burn_subtitle: bool | None = None


class Project(BaseModel):
    """Full project record persisted as one JSON file in storage/projects/<id>.json."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    title: str
    input_type: Literal["text", "url", "file"]
    input_value: str | None = None
    upload_path: str | None = None
    raw_text: str | None = None
    template: str = "news"
    aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    voice: str | None = None
    use_agent: bool = False
    burn_subtitle: bool = True
    status: ProjectStatus = "draft"
    storyboard: dict[str, Any] | None = None
    subtitle_path: str | None = None
    output_path: str | None = None
    error: str | None = None
    scenes: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
