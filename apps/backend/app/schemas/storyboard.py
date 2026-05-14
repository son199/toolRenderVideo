"""Storyboard schema returned by the LLM and consumed by render."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class WordTiming(BaseModel):
    word: str
    start: float  # seconds
    end: float


class SceneSpec(BaseModel):
    id: int = Field(..., ge=0)
    duration_sec: float = Field(..., ge=1.0, le=15.0)
    # Không ép buộc field text, cho phép các trường động như headline, stats, lines, ...
    visual_prompt: str = ""
    style: str | None = None
    voice: str | None = None

    class Config:
        extra = "allow"  # Cho phép các trường động ngoài schema mặc định


class Storyboard(BaseModel):
    title: str
    aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    template: str = "news"
    # Theme drives palette via body[data-theme] on the render stage. Defaults to
    # "default" (template's baseline palette). StoryboardAgent overrides this
    # with the analyzer's classification when run via agent path. LLM may also
    # set it directly in the JSON output.
    theme: Literal["danger", "warning", "default", "success"] = "default"
    scenes: list[SceneSpec]
    total_duration_sec: float = Field(..., ge=1.0)

    class Config:
        extra = "allow"  # Cho phép LLM trả thêm `meta`, `slug`, hoặc field mới

    @classmethod
    def from_scenes(
        cls,
        *,
        title: str,
        template: str,
        aspect_ratio: str,
        scenes: list[SceneSpec],
        theme: str = "default",
    ) -> "Storyboard":
        total = sum(s.duration_sec for s in scenes)
        return cls(
            title=title,
            template=template,
            aspect_ratio=aspect_ratio,  # type: ignore[arg-type]
            theme=theme,  # type: ignore[arg-type]
            scenes=scenes,
            total_duration_sec=total,
        )
