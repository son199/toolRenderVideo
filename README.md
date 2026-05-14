# AIVidForge

AI tool tự động tạo video ngắn (Shorts / Reels / TikTok) end-to-end:

**Text / URL / File → GPT storyboard → TTS → Hyperframes (HTML + GSAP) → Playwright record → FFmpeg → MP4**

Phase 1 đã đóng — pipeline đầy đủ chạy local, không cần Postgres/Redis/Docker. Bấm 1 nút trong UI là ra MP4 1080×1920 có voice + subtitle.

## Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind + TanStack Query |
| Backend | Python 3.10+ + FastAPI + async pipeline (no Celery in Phase 1) |
| Storage (Phase 1) | File-based JSON dưới `storage/projects/<uuid>.json` |
| Render engine | Hyperframes (HTML + CSS + GSAP) + Playwright + FFmpeg |
| LLM | OpenAI / Anthropic Claude / Google Gemini (switch qua `.env`) |
| TTS | Edge-TTS (Microsoft) / gTTS / ElevenLabs / OpenAI-TTS |
| Subtitle | Word boundaries từ TTS, fallback `faster-whisper` (lazy import) |
| Logging | structlog (JSON / console) |

## Cấu trúc repo

```
toolVideoShort/
├── apps/
│   ├── frontend/                # React + Vite UI
│   └── backend/                 # FastAPI + async pipeline
├── packages/
│   └── hyperframes/             # 3 template (news / promo / motivational)
│       ├── shared/              # base.css + runner.js + subtitles.css
│       ├── templates/<id>/      # SKILL.md + index.html + style.css + animation.js + meta.json + fixture.json
│       └── dev.html             # Dev preview page
├── scripts/
│   └── smoke.py                 # CLI test text → MP4 không cần UI
├── storage/                     # runtime (gitignored: audio/, output/, frames/, projects/, uploads/)
├── docker-compose.yml           # Phase 2 services (Postgres, Redis, MinIO)
├── .env.example
└── README.md
```

---

## Yêu cầu môi trường

- **Node.js 20+** và `npm` (hoặc `pnpm` — repo có `pnpm-workspace.yaml` nhưng `npm` cũng chạy được trong `apps/frontend/`).
- **Python 3.10+**. Nếu chỉ có 3.10, vẫn OK — pyproject yêu cầu `>=3.10`.
- **FFmpeg** trên PATH (Gyan build trên Windows: `winget install Gyan.FFmpeg`).
- **Đĩa trống ~600 MB** (Chromium ~200MB, dependencies Python ~250MB, dependencies Node ~150MB).
- **Internet** để gọi LLM API + Edge-TTS (Bing) hoặc gTTS (Google).

> Không cần Postgres, Redis, Docker trong Phase 1. Project lưu JSON dưới `storage/projects/`.

---

## Quick start

### 1. Clone & env

```bash
git clone <repo-url> aividforge
cd aividforge
cp .env.example .env
```

Mở `.env` và set ít nhất 1 LLM key:
- **Claude (mặc định)** — set `ANTHROPIC_API_KEY` (+ `ANTHROPIC_BASE_URL` nếu dùng proxy gateway như local).
- **OpenAI** — set `OPENAI_API_KEY` và đổi `LLM_PROVIDER=openai`.
- **Gemini** — set `GOOGLE_API_KEY` và đổi `LLM_PROVIDER=gemini`.

### 2. Backend

```bash
cd apps/backend
python -m venv .venv

# Windows
.\.venv\Scripts\python.exe -m pip install -e .

# macOS/Linux
./.venv/bin/python -m pip install -e .

# Cài Chromium cho Playwright
./.venv/bin/python -m playwright install chromium

# Chạy
./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Trên Windows, nếu ổ C: hết dung lượng, redirect Playwright cache trước khi cài Chromium:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "E:\playwright-browsers"
.\.venv\Scripts\python.exe -m playwright install chromium
```

Backend tự đọc env này nếu folder tồn tại — không phải set lại lúc chạy uvicorn.

### 3. Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Mở **http://localhost:5173**.

### 4. Kiểm tra

- `GET /health` → `{"status":"ok"}`
- API docs Swagger: http://localhost:8000/docs
- Hyperframes dev preview: http://localhost:8000/static/hyperframes/dev.html

---

## Sử dụng (UI)

1. Bấm **"New project"** → dán text Việt (hoặc URL, hoặc upload PDF/DOCX/TXT) → chọn template + tỉ lệ + voice → bấm **Tạo & ingest**.
2. Vào trang detail → bấm **"Run full pipeline"** → xem progress bar realtime (storyboard → TTS → render).
3. Khi 100% → video MP4 tự xuất hiện trong tab, play được luôn.

## Sử dụng (CLI - không cần UI)

```bash
python scripts/smoke.py \
    --text "Trí tuệ nhân tạo đang thay đổi cách làm video..." \
    --template motivational \
    --aspect 9:16 \
    --voice vi-VN-HoaiMyNeural \
    --out demo.mp4
```

Hỗ trợ thêm `--url <link>` hoặc `--file <path>`. Script này cần backend đang chạy ở `http://127.0.0.1:8000` (đổi bằng `--api`).

---

## .env keys

Xem [.env.example](./.env.example) cho list đầy đủ. Các key chính:

| Key | Default | Mô tả |
|---|---|---|
| `LLM_PROVIDER` | `claude` | `openai` / `claude` / `gemini` |
| `ANTHROPIC_API_KEY` | (rỗng) | Key Anthropic (hoặc proxy gateway key) |
| `ANTHROPIC_BASE_URL` | (rỗng) | Để rỗng = api.anthropic.com chính chủ. Set khi dùng proxy gateway. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | ID model (có thể custom như `cc/claude-sonnet-4-6` cho proxy) |
| `OPENAI_API_KEY` | (rỗng) | Key OpenAI |
| `OPENAI_MODEL` | `gpt-4.1` | |
| `TTS_PROVIDER` | `edge` | `edge` / `gtts` / `elevenlabs` / `openai` |
| `TTS_DEFAULT_VOICE` | `vi-VN-HoaiMyNeural` | Edge-TTS voice id |
| `STORAGE_DIR` | `../../storage` | Đường dẫn folder runtime |
| `PLAYWRIGHT_HEADLESS` | `true` | Đổi sang `false` để xem browser khi render (debug) |
| `RENDER_FPS` | `30` | |
| `LOG_LEVEL` | `INFO` | |
| `LOG_JSON` | `false` | `true` để log JSON một dòng (production) |

---

## Tune prompt cho từng ngách

Mỗi template có 1 file `SKILL.md`:

```
packages/hyperframes/templates/news/SKILL.md
packages/hyperframes/templates/promo/SKILL.md
packages/hyperframes/templates/motivational/SKILL.md
```

Format: YAML frontmatter (`name`, `description`) + markdown body. Body chính là system prompt cho LLM khi sinh storyboard cho ngách đó. Sửa markdown → restart backend → request `POST /projects/{id}/storyboard` mới — không động code.

Thêm ngách mới: `mkdir templates/explainer`, copy 5 file từ `news/` rồi sửa. Backend auto-detect; frontend cần thêm option trong `apps/frontend/src/pages/NewProject.tsx`.

---

## Troubleshooting

### Edge-TTS lỗi SSL `CERTIFICATE_VERIFY_FAILED`

Windows trust store reject cert của Bing trên máy bạn (thường do firewall/antivirus chen TLS). Hai cách:

**Cách nhanh:** Đổi `TTS_PROVIDER=gtts` trong `.env`. Google không bị block. Nhược điểm: gTTS không có word timings → subtitle 1-câu-mỗi-scene thay vì karaoke từng từ.

**Cách đúng:** Mở `certmgr.msc`, kiểm tra Microsoft root cert + cert của firewall/antivirus được trust. Tham khảo IT.

### npm install lỗi ENOSPC (hết dung lượng C:)

Trên Windows, npm cache + temp mặc định trên C:. Redirect:

```powershell
npm config set cache E:\npm-cache
$env:TEMP = "E:\npm-tmp"; $env:TMP = "E:\npm-tmp"
mkdir E:\npm-tmp -Force
cd apps/frontend
npm install
```

### Playwright báo "Executable doesn't exist"

Browser cache đi nhầm chỗ. Set env trước khi install:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "E:\playwright-browsers"
.\.venv\Scripts\python.exe -m playwright install chromium
```

Backend đã có logic auto-set env này khi folder `E:\playwright-browsers` tồn tại — không phải config lại.

### Vietnamese mojibake trong terminal

Stdout của Python trên Windows mặc định `cp1252`. Thêm vào script test:

```python
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

Hoặc set `PYTHONUTF8=1` trong env.

### Video render quá lâu / drop frame

Playwright record qua CDP ở ~25fps mặc định. Nếu GSAP animation phức tạp, có thể drop. Cách khắc phục:
- Đơn giản scene timing (tăng `duration_sec` từng scene, giảm số scene)
- Đổi `PLAYWRIGHT_HEADLESS=false` để xem browser thật chạy ra sao
- Phase tới có thể chuyển sang screenshot capture deterministic

---

## Roadmap

### Phase 1 (đã đóng)
- Pipeline end-to-end: text → MP4
- 3 template (news / promo / motivational) + SKILL.md per-niche
- Async pipeline + WebSocket progress
- File-based storage, no DB

### Phase 2 (planned)
- Postgres + Celery + Redis (xem `docker-compose.yml`, deps đã pin trong `[db]` / `[queue]` optional groups)
- Multi-user + auth (DB schema đã giữ `user_id` nullable)
- Timeline editor kéo thả
- ComfyUI integration cho AI image gen vào `visual_prompt`
- Auto upload YouTube / TikTok

### Phase 3
- Cloud rendering (GPU worker pool)
- Video dài 3-30 phút (streaming render, chunked concat)
- Public API + analytics dashboard

---

## License

TBD.
