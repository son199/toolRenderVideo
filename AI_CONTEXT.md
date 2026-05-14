# AIVidForge / Hyperframes — Developer & AI Context Guide

> **MỤC ĐÍCH FILE NÀY**: Giúp các AI Agent/Assistant hiểu rõ toàn bộ kiến trúc dự án, biết chính xác luồng chạy (flow) và **chỉ cần đọc những file cần thiết**, tránh đọc lan man gây tốn token và nhầm lẫn ngữ cảnh.

## 1. Tổng quan Kiến trúc (Architecture)

Dự án là một hệ thống tự động sinh video ngắn (TikTok/Reels/Shorts) từ text/URL. Nó bao gồm 2 thành phần chính:

- **Backend (Python / FastAPI)**: Quản lý LLM orchestration (sinh kịch bản, chấm điểm), gọi API TTS (đọc giọng nói), và điều khiển Playwright (chạy headless browser để quay video).
- **Hyperframes (JS / CSS / GSAP)**: Engine render giao diện HTML tĩnh thành Video. Sử dụng GSAP Timeline để đồng bộ hoạt ảnh (animation) với giọng đọc.

---

## 2. Bản đồ Thư mục (Directory Map) — AI CẦN ĐỌC GÌ?

Để sửa một tính năng cụ thể, **chỉ nên đọc các file trong đúng thư mục đó**. Đừng đọc chéo.

### 🧠 A. LLM & Kịch bản (AI Agents)
Nằm tại: `apps/backend/app/agents/`
- `storyboard_agent.py`, `review_agent.py`: Nơi quản lý luồng LLM sinh kịch bản và tự động chấm điểm (Refine).
- `prompts/reviewer.py`: Chứa Rubric (tiêu chí) chấm điểm kịch bản. **Cần sửa prompt reviewer? Đọc file này.**
- `prompts/analyzer.py`, `prompts/refine.py`: Các prompt khác.
- `packages/hyperframes/templates/<template>/SKILL.md`: Đây là file định nghĩa luật viết kịch bản (scene schema, animation hooks) cho từng ngách video. **Lỗi kịch bản sinh ra sai định dạng? Sửa file này.**

### ⚙️ B. Pipeline Render (Backend Jobs)
Nằm tại: `apps/backend/app/services/`
- `jobs.py`: Trái tim của backend. Pipeline chạy tuần tự: Ingest -> LLM (Storyboard) -> TTS -> Playwright -> FFmpeg. **Lỗi luồng chạy (bỏ qua render, sai output)? Đọc file này.**
- `tts/`: Xử lý giọng đọc (Edge-TTS, OpenAI, ElevenLabs).
- `render/playwright_recorder.py`: Khởi chạy trình duyệt headless để thu video từ Hyperframes.
- `render/ffmpeg_post.py`: Ghép file `.webm` (từ playwright) với file âm thanh gốc tạo ra mp4.

### 🎬 C. Engine Animation (Hyperframes Frontend)
Nằm tại: `packages/hyperframes/`
- `shared/cinematic.js`: Nơi chứa các hàm hiệu ứng lõi (Mesh Background, Dolly Zoom, Text Shadow Breath, Particles).
- `shared/runner.js`: Đọc dữ liệu JSON, gọi `buildTimeline()`, báo cho Playwright biết khi nào quay xong.
- `templates/<template_name>/`: Mỗi ngách (news, promo, motivational) có 1 bộ render riêng:
  - `index.html`: Cấu trúc DOM tĩnh (không nên sửa nhiều).
  - `style.css`: Nơi styling Glassmorphism, colors, themes.
  - `animation.js`: File quan trọng nhất. Nhận JSON từ backend, gán DOM và gọi GSAP animation cho từng scene. **Lỗi video không có hiệu ứng, chữ đứng yên? Sửa file này.**

---

## 3. Các Hack & Logic đặc biệt cần nhớ

1. **Word Timings (Subtitle sync)**: 
   - Backend dùng TTS (như Edge TTS) lấy thời gian từng từ.
   - Chuyển thành file `.srt` và mảng `tts_beats` trong JSON. GSAP sẽ lấy mốc thời gian này để trigger hiệu ứng.
2. **Dynamic AI Backgrounds (Chống "1000 video như 1")**:
   - Kiến trúc cũ chỉ dùng Gradient CSS.
   - *Bản Hack mới (Promo template)*: Nếu LLM sinh `visual_prompt`, frontend (trong `animation.js`) sẽ tự động gọi API ảnh miễn phí của `Pollinations.ai` để render thành ảnh nền thực tế (`<img>` element) và áp dụng hiệu ứng Dolly Zoom lên đó.
3. **Idempotent Pipeline**:
   - `jobs.py` kiểm tra `project.status`. Nếu video đã có storyboard, nó sẽ bỏ qua bước gọi AI. Nếu muốn AI sinh lại kịch bản, phải xóa kịch bản cũ hoặc đổi status project.

---

## 4. Work Flow Tối Ưu cho AI (Giảm Token)

- **Bước 1**: Xem qua cấu trúc lỗi (vd: "video không khớp nhạc", "UI vỡ").
- **Bước 2**: Tra cứu bảng trên xem lỗi thuộc Backend (B), Prompt (A), hay Hyperframes (C).
- **Bước 3**: Chạy tool `view_file` **duy nhất** file đang bị nghi ngờ. Hạn chế đọc log hoặc file thừa.
- **Bước 4**: Sử dụng lệnh sửa trực tiếp hàm đó.

> *Lưu ý: Hãy luôn tuân thủ file hướng dẫn này.*
