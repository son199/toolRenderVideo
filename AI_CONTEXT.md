# AIVidForge — Developer & AI Context Guide

> **MỤC ĐÍCH FILE NÀY**: Giúp các AI Agent/Assistant hiểu rõ toàn bộ kiến trúc dự án, biết chính xác luồng chạy (flow) và **chỉ cần đọc những file cần thiết**, tránh đọc lan man gây tốn token và nhầm lẫn ngữ cảnh.

## 1. Tổng quan Kiến trúc (Architecture)

Dự án là một hệ thống tự động sinh video ngắn (TikTok/Reels/Shorts) từ text/URL. Nó bao gồm 2 thành phần chính:

- **Backend (Python / FastAPI)**: Quản lý LLM orchestration (sinh kịch bản, chấm điểm), gọi API TTS (đọc giọng nói), và gọi Remotion CLI để render video.
- **Remotion Engine (React / TS)**: Engine render duy nhất. Mỗi scene là một React component; SceneRouter chọn layout theo `scene.type` (hero / stat / quote / comparison / list / product / cta / kinetic).

> **Lưu ý lịch sử**: Phiên bản cũ dùng Hyperframes (HTML/CSS/GSAP + Playwright) đã bị gỡ. Engine hiện tại là **Remotion-only**.

---

## 2. Bản đồ Thư mục (Directory Map) — AI CẦN ĐỌC GÌ?

Để sửa một tính năng cụ thể, **chỉ nên đọc các file trong đúng thư mục đó**. Đừng đọc chéo.

### 🧠 A. LLM & Kịch bản (AI Agents)
Nằm tại: `apps/backend/app/agents/` và `apps/backend/app/services/llm/`
- `agents/content_analyzer.py`: phân tích nội dung → AnalyzerResult (hook, theme, scene_type_mix).
- `agents/storyboard_agent.py`, `agents/review_agent.py`: Nơi quản lý luồng LLM sinh kịch bản và tự động chấm điểm (Refine).
- `agents/prompts/reviewer.py`: Chứa Rubric (tiêu chí) chấm điểm kịch bản. **Sửa rubric? Đọc file này.**
- `agents/prompts/analyzer.py`, `agents/prompts/refine.py`: Các prompt khác.
- `services/llm/prompts.py`: Build system + user prompt cho storyboard. Inject SKILL.md.
- `services/scene_types.py`: Python mirror của vocabulary scene-type — source of truth.
- `packages/remotion-engine/skills/<template>.md`: SKILL.md per-niche (news / promo / motivational). **Lỗi kịch bản sinh ra đơn điệu hoặc sai phong cách? Sửa file này.**

### ⚙️ B. Pipeline Render (Backend Jobs)
Nằm tại: `apps/backend/app/services/`
- `jobs.py`: Trái tim của backend. Pipeline chạy tuần tự: Ingest → LLM (Storyboard) → TTS (+ Whisper alignment fallback) → Remotion CLI. **Lỗi luồng chạy (bỏ qua render, sai output)? Đọc file này.**
- `tts/`: Xử lý giọng đọc (Edge-TTS, OpenAI, ElevenLabs, gTTS).
- `subtitle.py`: build SRT + `whisper_align()` forced-alignment cho voice sync.
- `render/remotion.py`: Gọi Remotion CLI render JSON → MP4.

### 🎬 C. Engine Animation (Remotion Frontend)
Nằm tại: `packages/remotion-engine/src/`
- `MainVideo.tsx`: Composition root — duyệt scenes, gọi SceneRouter.
- `components/SceneRouter.tsx`: Switch theo `scene.type` → component cụ thể.
- `components/scenes/types.ts`: Vocabulary scene-type + `SCENE_TYPE_CONFIG` (particle count, ken burns, waveform, badge per type).
- `components/scenes/{Hero,Stat,Quote,Comparison,List,Product,Cta,Kinetic}Scene.tsx`: 8 layout component khác nhau.
- `components/shared/`: SceneBackground, WordReveal, useSceneTiming (dùng chung).
- `skills/<template>.md`: SKILL.md per-niche cho LLM.

---

## 3. Các Hack & Logic đặc biệt cần nhớ

1. **Word Timings (voice sync)**:
   - TTS trả `word_timings` (Edge TTS native, ElevenLabs native).
   - Nếu provider không có → `jobs.py` fallback `whisper_align()` (faster-whisper) trên audio đã render.
   - Remotion `useSceneTiming` đọc word_timings để time chính xác từng từ.
   - **NEVER** rely on KineticScene linear fallback ở production — nó chỉ chia đều `duration_sec / word_count`.

2. **Visual variety (chống "1000 video như 1")**:
   - LLM analyzer suy ra `scene_type_mix` (vd `{"hero":1, "stat":2, "comparison":1, "cta":1}`).
   - Storyboard prompt yêu cầu ≥3 scene type khác nhau, không quá 2 cùng type liên tiếp, kết thúc bằng `cta`.
   - SceneRouter dispatch sang layout component khác nhau → background, motion, accent đều khác nhau.

3. **Idempotent Pipeline**:
   - `jobs.py` kiểm tra `project.status`. Nếu video đã có storyboard, nó sẽ bỏ qua bước gọi AI. Nếu muốn AI sinh lại kịch bản, phải xóa kịch bản cũ hoặc đổi status project.

---

## 4. Work Flow Tối Ưu cho AI (Giảm Token)

- **Bước 1**: Xem qua cấu trúc lỗi (vd: "video không khớp nhạc", "scene giống nhau hết", "tone không đúng chủ đề").
- **Bước 2**: Tra cứu bảng trên xem lỗi thuộc Backend Pipeline (B), Prompt/Agents (A), hay Remotion Frontend (C).
- **Bước 3**: Đọc duy nhất file đang nghi ngờ. Hạn chế đọc log hoặc file thừa.
- **Bước 4**: Sửa trực tiếp hàm đó.

> *Lưu ý: Hãy luôn tuân thủ file hướng dẫn này.*
