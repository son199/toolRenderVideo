"""Shared JSON extraction used by every provider and agent."""

from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.schemas.storyboard import Storyboard
from app.services.llm.base import LLMError

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")

_REPO_ROOT = Path(__file__).resolve().parents[5]
_DEBUG_DIR = _REPO_ROOT / "storage" / "debug" / "llm"

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)


def parse_storyboard(raw: str) -> Storyboard:
    """Extract the first JSON object in `raw` and validate it as a Storyboard."""
    return parse_json_model(raw, Storyboard)


def parse_json_model(raw: str, model: type[ModelT]) -> ModelT:
    """Generic: extract first JSON object in `raw` and validate against `model`.

    Two-stage parse for LLM output robustness:
      1. ``json.loads`` on the extracted candidate (strict, fast path).
      2. Fallback: strip trailing commas, then ``json_repair.loads`` (handles
         missing commas, unclosed strings, smart quotes, etc.) — large models
         frequently emit subtle violations near the tail of long outputs.

    On total failure dumps the full raw output to ``storage/debug/llm/`` so
    we can diagnose without re-running the (expensive) LLM call.
    """
    candidate = extract_json(raw)

    # Stage 1: strict
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as strict_exc:
        # Stage 2: cheap repair pass (trailing commas) — covers ~80% of LLM mistakes
        cleaned = _TRAILING_COMMA_RE.sub(r"\1", candidate)
        try:
            data = json.loads(cleaned)
            logger.warning(
                "LLM %s output had trailing commas — repaired locally", model.__name__
            )
        except json.JSONDecodeError:
            # Stage 3: json_repair — heavier, handles many more violations
            try:
                from json_repair import loads as repair_loads
            except ImportError:
                repair_loads = None  # type: ignore[assignment]

            if repair_loads is not None:
                try:
                    data = repair_loads(candidate)
                    logger.warning(
                        "LLM %s output required json_repair fallback (%s)",
                        model.__name__,
                        strict_exc,
                    )
                except Exception as repair_exc:  # noqa: BLE001
                    _dump_bad_output(model.__name__, raw, strict_exc, repair_exc)
                    raise LLMError(
                        f"LLM returned non-JSON output: {strict_exc}\n"
                        f"json_repair also failed: {repair_exc}\n"
                        f"Full raw dumped to {_DEBUG_DIR}"
                    ) from strict_exc
            else:
                _dump_bad_output(model.__name__, raw, strict_exc, None)
                raise LLMError(
                    f"LLM returned non-JSON output: {strict_exc}\n"
                    f"Full raw dumped to {_DEBUG_DIR}\n"
                    f"Raw head: {raw[:500]}"
                ) from strict_exc

    try:
        return model.model_validate(data)
    except ValidationError as exc:
        _dump_bad_output(model.__name__, raw, exc, None, parsed=data)
        raise LLMError(f"{model.__name__} schema mismatch: {exc}") from exc


def extract_json(text: str) -> str:
    """Pull the first JSON object out of a possibly-fenced / prose-wrapped string."""
    text = text.strip()
    fence_match = _FENCE_RE.search(text)
    if fence_match:
        return fence_match.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMError(f"No JSON object found in LLM output: {text[:200]}")
    return text[start : end + 1]


def _dump_bad_output(
    model_name: str,
    raw: str,
    primary_exc: Exception,
    secondary_exc: Exception | None,
    parsed: object | None = None,
) -> None:
    """Write the offending raw output + traceback to disk for later inspection."""
    try:
        _DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        ts = time.strftime("%Y%m%d-%H%M%S")
        path = _DEBUG_DIR / f"{ts}-{model_name}.txt"
        with path.open("w", encoding="utf-8") as f:
            f.write(f"=== Primary error ===\n{primary_exc!r}\n\n")
            if secondary_exc is not None:
                f.write(f"=== Secondary error ===\n{secondary_exc!r}\n\n")
            if parsed is not None:
                f.write(f"=== Parsed (but invalid) ===\n{parsed!r}\n\n")
            f.write("=== Raw LLM output ===\n")
            f.write(raw)
        logger.error("Bad LLM %s output dumped to %s", model_name, path)
    except Exception as dump_exc:  # noqa: BLE001
        logger.warning("Failed to dump bad LLM output: %s", dump_exc)


# Back-compat shim for any code still importing the old private name.
_extract_json = extract_json
