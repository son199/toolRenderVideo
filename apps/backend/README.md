# AIVidForge Backend

FastAPI service that runs the video generation pipeline.

Phase 1 uses **file-based JSON storage** (no Postgres / Celery) — projects live
under `storage/projects/<id>.json`. Swapping to Postgres + Celery is a Phase 2
task and the optional `[db]` / `[queue]` dependency groups in `pyproject.toml`
already pin the libraries we'll use.

## Run

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## Structure

```
app/
├── main.py           # FastAPI app
├── config.py         # Settings (pydantic-settings)
├── repository.py     # File-based JSON repo for projects
├── schemas/          # Pydantic models (request/response & persisted records)
├── api/              # HTTP routers
├── services/         # Domain services (ingest, llm, tts, render, subtitle) — added per sprint
└── tasks/            # Celery tasks (added when queue lands)
```
