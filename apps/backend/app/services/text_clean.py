"""Vietnamese text cleanup — normalize Unicode + fix LLM artifacts.

The pipeline (LLM → TTS → Whisper → Remotion) can introduce two kinds of text
defects that ruin the rendered video:

1. **Unicode normalization drift**: input arrives in NFC (precomposed), but some
   tool in the chain decomposes diacritics to NFD ("gần" = "ga" + combining
   grave + "n"). Combined with a font that lacks Vietnamese combining-mark
   rules, this renders as "gâ`n" with the accent floating beside the letter.

2. **LLM space artifacts**: the LLM occasionally emits stray spaces inside
   Vietnamese syllables, e.g. "cạnh t ranh" instead of "cạnh tranh", or "h ai"
   instead of "hai". These come from the LLM's tokenizer chunking a Vietnamese
   word across two output tokens with whitespace in between.

`clean_vi(text)` applies NFC normalization plus a small set of safe glue-back
patterns for the common artifacts. It's safe to call on any string — empty
input returns empty.
"""

from __future__ import annotations

import re
import unicodedata

# Single Vietnamese consonant or 2-letter cluster followed by a space and a
# lowercase letter — strong signal of "h ai" → "hai", "t ranh" → "tranh".
# We constrain the leading bit to consonants that NEVER stand alone as a
# Vietnamese word, so we don't accidentally glue legit single-letter tokens.
_GLUE_CONSONANT_RE = re.compile(
    r"(?<![A-Za-zÀ-ỹ])"
    r"([bcdfghjklmnpqrstvwxz]|ch|kh|nh|ph|th|tr|gh|ng|ngh|qu|gi)"
    r"\s+"
    r"([aăâeêiouôơưyàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ])",
    re.IGNORECASE,
)

# Collapse multiple consecutive spaces and trim
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def clean_vi(text: str | None) -> str:
    """Return `text` with NFC normalization + space artifacts removed."""
    if not text:
        return ""
    # 1. Unicode normalize to NFC so combining marks compose into single
    #    codepoints. Remotion's Chromium font fallback handles NFC well; NFD
    #    is what renders as "gâ`n".
    s = unicodedata.normalize("NFC", text)
    # 2. Glue back single-consonant + space + vowel patterns (Vietnamese
    #    syllables never start with consonant + space + vowel).
    s = _GLUE_CONSONANT_RE.sub(r"\1\2", s)
    # 3. Collapse runs of spaces and trim
    s = _MULTI_SPACE_RE.sub(" ", s).strip()
    return s


def clean_vi_deep(obj):  # noqa: ANN001 — recursive any-shape walker
    """Recursively walk a JSON-like structure and clean_vi() every string leaf.

    Useful for normalizing whole storyboard / scene dicts before persisting or
    handing off to TTS. Lists and dicts are walked in place (returned as new
    structures); other types pass through unchanged.
    """
    if isinstance(obj, str):
        return clean_vi(obj)
    if isinstance(obj, dict):
        return {k: clean_vi_deep(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_vi_deep(v) for v in obj]
    return obj
