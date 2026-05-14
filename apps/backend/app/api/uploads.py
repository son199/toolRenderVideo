"""File upload endpoint — writes to storage/uploads/<uuid>.<ext> and returns the path.

Used by the frontend before POST /projects with input_type=file.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("", status_code=201)
async def upload_file(file: UploadFile = File(...)) -> dict[str, str | int]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file extension: {suffix or '(none)'}. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    upload_dir = get_settings().storage_uploads
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4()}{suffix}"

    size = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
            out.write(chunk)

    return {
        "upload_path": str(dest),
        "filename": file.filename or dest.name,
        "size_bytes": size,
    }
