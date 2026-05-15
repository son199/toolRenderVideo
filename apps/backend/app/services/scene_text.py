"""Resolve the Vietnamese narration text for any rich scene type.

Rich scene types (hero-text, product-card, question-hero, line-statement, …)
don't all carry a flat `text` field — they have type-specific fields like
`headline`, `question`, `line`, `name`. Every scene is required to carry
`caption.vi` per the prompt schema, so that's the primary source for TTS +
subtitle fallback. The type-specific fields are last-resort fallbacks for
legacy / partial storyboards.
"""

from __future__ import annotations

from typing import Any

from app.services.text_clean import clean_vi


def narration_text(scene: dict[str, Any]) -> str:
    """Return the Vietnamese narration string for one scene.

    Lookup order:
      1. ``caption.vi`` (required field on every scene per prompt schema)
      2. legacy flat ``text``
      3. type-specific body fields (hero-text → headline, question-hero →
         question, line-statement → line, product-card → name + tagline,
         cta-url → label, closing-card → line)
      4. empty string (caller may treat as warning)
    """
    caption = scene.get("caption")
    if isinstance(caption, dict):
        vi = caption.get("vi")
        if isinstance(vi, str) and vi.strip():
            return clean_vi(vi)

    text = scene.get("text")
    if isinstance(text, str) and text.strip():
        return clean_vi(text)

    # Type-specific body fallbacks (when caption.vi is missing entirely)
    scene_type = scene.get("type", "")
    fallback_keys: tuple[str, ...]
    if scene_type in ("hero", "hero-text", "hook", "problem"):
        fallback_keys = ("headline", "sub")
    elif scene_type in ("stat", "stats-grid"):
        fallback_keys = ("number", "label", "headline")
    elif scene_type in ("product", "product-card"):
        fallback_keys = ("name", "tagline", "subtext")
    elif scene_type in ("question-hero", "question"):
        fallback_keys = ("question",)
    elif scene_type in ("line-statement", "line"):
        fallback_keys = ("line",)
    elif scene_type in ("quote", "quote-card"):
        fallback_keys = ("quote", "text", "attribution")
    elif scene_type in ("comparison",):
        fallback_keys = ("left", "right", "headline")
    elif scene_type in ("list",):
        fallback_keys = ("headline", "items")
    elif scene_type in ("closing-card", "closing"):
        fallback_keys = ("line", "footer")
    elif scene_type in ("cta", "cta-url"):
        fallback_keys = ("label", "sub", "url")
    elif scene_type in ("kinetic",):
        fallback_keys = ("headline", "text")
    elif scene_type == "terminal":
        # Join terminal lines text fields
        lines = scene.get("lines")
        if isinstance(lines, list):
            joined = " ".join(
                str(line.get("text", "")).strip()
                for line in lines
                if isinstance(line, dict) and line.get("text")
            ).strip()
            if joined:
                return joined
        fallback_keys = ()
    else:
        fallback_keys = ()

    parts: list[str] = []
    for key in fallback_keys:
        value = scene.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    if parts:
        return clean_vi(". ".join(parts))

    return ""
