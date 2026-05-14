"""Load per-niche SKILL.md prompt files.

Each Hyperframes template folder may contain a SKILL.md with optional YAML frontmatter:

    ---
    name: news
    description: 25-32s tech-news short, hook + stats + CTA
    ---
    <markdown body — used as the LLM system prompt for this template>

If the file is missing, callers should fall back to the generic prompt in
``app.services.llm.prompts``. Parsed values are cached in-process; restart the
process (or call ``reload_skills()``) to pick up edits during development.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from app.config import get_settings

logger = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


@dataclass(frozen=True)
class Skill:
    template: str
    name: str
    description: str
    body: str

    @property
    def system_prompt(self) -> str:
        return self.body


def load_skill(template: str) -> Skill | None:
    """Return parsed SKILL.md for `template`, or None if the file doesn't exist."""
    return _load_cached(template)


def reload_skills() -> None:
    """Drop the in-process cache. Useful in dev when editing SKILL.md files."""
    _load_cached.cache_clear()


@lru_cache(maxsize=32)
def _load_cached(template: str) -> Skill | None:
    path = _skill_path(template)
    if not path.exists():
        logger.info("No SKILL.md for template '%s' at %s — using generic prompt", template, path)
        return None

    raw = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(raw)
    if match:
        try:
            meta = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError as exc:
            logger.warning("Invalid YAML frontmatter in %s: %s", path, exc)
            meta = {}
        body = match.group(2).strip()
    else:
        meta = {}
        body = raw.strip()

    skill = Skill(
        template=template,
        name=str(meta.get("name") or template),
        description=str(meta.get("description") or ""),
        body=body,
    )
    logger.info("Loaded SKILL.md for '%s' (%d chars)", template, len(body))
    return skill


def _skill_path(template: str) -> Path:
    return get_settings().hyperframes_dir / "templates" / template / "SKILL.md"
