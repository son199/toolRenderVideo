"""End-to-end smoke test: text → MP4, no UI.

Usage (backend must be running):

    python scripts/smoke.py \\
        --text "Trí tuệ nhân tạo đang thay đổi cách làm video..." \\
        --template motivational \\
        --aspect 9:16 \\
        --voice vi-VN-HoaiMyNeural \\
        --out demo.mp4

Or feed a URL / file:

    python scripts/smoke.py --url https://example.com/article --template news ...
    python scripts/smoke.py --file ./article.pdf ...

The script: POSTs /projects with the input → kicks off /run → streams the
WebSocket progress stream → polls the project record until status=completed →
copies the produced MP4 to --out.

Only depends on the Python standard library; no extra installs needed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    from websockets.asyncio.client import connect
except ImportError:  # pragma: no cover
    print("This script needs `websockets` (already a backend dep). Install with:")
    print("    pip install websockets")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="End-to-end smoke test (text/URL/file → MP4).")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--text", help="Inline text to turn into a video")
    src.add_argument("--url", help="Article URL to fetch and summarize")
    src.add_argument("--file", help="Path to a PDF/DOCX/TXT file to upload first")
    p.add_argument("--title", default="Smoke test", help="Project title")
    p.add_argument(
        "--template",
        default="news",
        choices=("news", "promo", "motivational"),
        help="Hyperframes template to use",
    )
    p.add_argument(
        "--aspect",
        default="9:16",
        choices=("9:16", "16:9"),
        help="Video aspect ratio",
    )
    p.add_argument("--voice", default="vi-VN-HoaiMyNeural", help="TTS voice id")
    p.add_argument(
        "--api",
        default="http://127.0.0.1:8000",
        help="Backend base URL",
    )
    p.add_argument("--out", default="demo.mp4", help="Output MP4 path on disk")
    p.add_argument(
        "--timeout",
        type=float,
        default=300.0,
        help="Maximum seconds to wait for the pipeline to finish",
    )
    return p.parse_args()


def post_json(url: str, body: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def upload_file(api: str, path: Path) -> str:
    """Multipart upload, returns the upload_path the backend will use."""
    boundary = "----aividforgesmokeboundary"
    body = bytearray()
    body += f"--{boundary}\r\n".encode()
    body += (
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
    ).encode()
    body += b"Content-Type: application/octet-stream\r\n\r\n"
    body += path.read_bytes()
    body += f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{api}/uploads",
        data=bytes(body),
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))["upload_path"]


async def stream_events(ws_url: str, deadline: float) -> str:
    """Stream progress events until 'done' or 'error'. Returns terminal stage."""
    async with connect(ws_url) as ws:
        async for raw in ws:
            event = json.loads(raw)
            pct = int(event["progress"] * 100)
            print(f"  [{pct:3d}%] {event['stage']:11s}  {event['message']}")
            if event["stage"] in ("done", "error"):
                return event["stage"]
            if time.monotonic() > deadline:
                return "timeout"
    return "closed"


async def amain() -> int:
    args = parse_args()
    api = args.api.rstrip("/")
    deadline = time.monotonic() + args.timeout

    # 1. Build create payload
    payload: dict[str, Any] = {
        "title": args.title,
        "template": args.template,
        "aspect_ratio": args.aspect,
        "voice": args.voice,
    }
    if args.text:
        payload["input_type"] = "text"
        payload["input_value"] = args.text
    elif args.url:
        payload["input_type"] = "url"
        payload["input_value"] = args.url
    else:
        payload["input_type"] = "file"
        payload["upload_path"] = upload_file(api, Path(args.file))

    # 2. Create project (this runs ingest synchronously)
    print(f"Creating project ({payload['input_type']})...")
    project = post_json(f"{api}/projects", payload)
    pid = project["id"]
    print(f"  → project_id={pid}  status={project['status']}")
    if project["status"] == "failed":
        print(f"Ingest failed: {project.get('error')}")
        return 1

    # 3. Kick off full pipeline
    print("Starting pipeline...")
    run = post_json(f"{api}/projects/{pid}/run", {})
    print(f"  → job_id={run['job_id']}")

    # 4. Stream events
    ws_scheme = "wss" if api.startswith("https") else "ws"
    ws_host = urllib.parse.urlsplit(api).netloc
    ws_url = f"{ws_scheme}://{ws_host}/ws/projects/{pid}/events"
    print(f"Streaming {ws_url}...")
    terminal = await stream_events(ws_url, deadline)
    if terminal != "done":
        print(f"Pipeline did not complete (stage={terminal}).")
        return 1

    # 5. Fetch final project record + copy MP4
    final = get_json(f"{api}/projects/{pid}")
    out_path_raw = final.get("output_path")
    if not out_path_raw:
        print("Project marked completed but output_path is missing")
        return 1

    src = Path(out_path_raw)
    if not src.is_absolute():
        # Backend stores paths relative to its cwd (apps/backend); resolve from repo root.
        src = (Path(__file__).resolve().parent.parent / "apps" / "backend" / src).resolve()

    dest = Path(args.out).resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"\n✓ Done. MP4 saved to: {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(amain()))
