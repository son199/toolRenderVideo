"""Convert project input (text / URL / file) to plain text.

Synchronous for Sprint 2 — moves to a Celery task in Sprint 6.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import httpx
import trafilatura
from docx import Document
from pypdf import PdfReader

from app.schemas.project import Project

logger = logging.getLogger(__name__)

MAX_TEXT_LEN = 30_000  # ~5-6K words; storyboard scenes cap < 8 anyway
URL_TIMEOUT = 15.0


class IngestError(Exception):
    """Raised when ingest fails — surfaced as 422 to the API caller."""


def ingest(project: Project) -> str:
    """Resolve project input to a plain-text string ready for the LLM."""
    if project.input_type == "text":
        if not project.input_value:
            raise IngestError("input_value is empty")
        return _truncate(project.input_value)

    if project.input_type == "url":
        if not project.input_value:
            raise IngestError("input_value (URL) is empty")
        return _from_url(project.input_value)

    if project.input_type == "file":
        if not project.upload_path:
            raise IngestError("upload_path is empty")
        return _from_file(Path(project.upload_path))

    raise IngestError(f"Unknown input_type: {project.input_type}")


def _from_url(url: str) -> str:
    try:
        with httpx.Client(timeout=URL_TIMEOUT, follow_redirects=True) as client:
            response = client.get(url, headers={"User-Agent": "AIVidForge/0.1"})
            response.raise_for_status()
            html = response.text
    except httpx.HTTPError as exc:
        raise IngestError(f"Failed to fetch URL: {exc}") from exc

    extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
    if not extracted:
        raise IngestError("Could not extract readable text from URL")
    return _truncate(extracted)


def _from_file(path: Path) -> str:
    if not path.exists():
        raise IngestError(f"Upload file not found: {path}")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        text = _read_pdf(path)
    elif suffix in {".docx"}:
        text = _read_docx(path)
    elif suffix in {".txt", ".md"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
    else:
        raise IngestError(f"Unsupported file type: {suffix}")

    if not text.strip():
        raise IngestError("File appears to contain no readable text")
    return _truncate(text)


def _read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception as exc:
            logger.warning("PDF page extract failed: %s", exc)
    return "\n\n".join(p for p in parts if p)


def _read_docx(path: Path) -> str:
    doc = Document(io.BytesIO(path.read_bytes()))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text)


def _truncate(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_TEXT_LEN:
        return text
    return text[:MAX_TEXT_LEN].rstrip() + "\n\n[...truncated...]"
