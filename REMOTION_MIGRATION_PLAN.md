# Kế Hoạch Di Tản Kiến Trúc: Chuyển Đổi Sang Remotion.js

Quyết định chuyển sang **Remotion** là một bước đi cực kỳ chính xác để xây dựng một hệ thống **SaaS Video Automation** đúng nghĩa, vượt qua hoàn toàn cái bóng "Slideshow" của HTML/CSS cũ. 

Dưới đây là Roadmap chi tiết để "đập đi xây lại" phần Render mà vẫn tận dụng tối đa Backend AI hiện có.

---

## TỔNG QUAN KIẾN TRÚC MỚI

1. **Backend (Giữ nguyên 80%)**: 
   - `jobs.py`: Vẫn chạy luồng Ingest → AI Storyboard → TTS.
   - Dữ liệu `word_timings` (đã có sẵn từ Edge-TTS) bây giờ sẽ trở thành "vũ khí tối thượng" cho Remotion.
2. **Tắt bỏ Playwright & FFmpeg cũ (Bỏ đi 20%)**:
   - `playwright_recorder.py` và `ffmpeg_post.py` sẽ bị loại bỏ.
   - Backend sẽ gọi trực tiếp: `npx remotion render` (Remotion tích hợp sẵn FFmpeg xịn xò để mix Audio và Video, cực nhanh và không bao giờ bị lỗi Sync).
3. **Frontend Mới (Packages/remotion-engine)**:
   - Dùng **React.js + Remotion**.
   - Cứ mỗi 1 frame (1/60 giây), React sẽ tính toán chính xác chữ nào đang được nói để Highlight, video nào đang được chiếu để Zoom.

---

## 🛠 LỘ TRÌNH THỰC HIỆN (4 PHASE)

### Phase 1: Khởi tạo Remotion Engine (Workspace Mới)
- Dùng `npx create-video` tạo một package mới: `packages/remotion-engine`.
- Xóa bỏ thư mục `packages/hyperframes` cũ.
- Thiết lập Composition chuẩn TikTok/Shorts: `1080x1920`, `60 FPS`.

### Phase 2: Xây dựng Component Lõi (Core Components)
Đây là linh hồn để video không bị "1000 cái như 1":
- 🔠 **KineticTypography Component**: Nhận mảng `word_timings`. Cứ khi `currentFrame` chạy tới mốc thời gian của từ nào, từ đó sẽ Pop-up lên, sáng màu vàng/đỏ, và mờ đi khi đọc xong.
- 🖼️ **DynamicMedia Component**: Nhận `visual_prompt`. Nó tự động gọi ảnh AI hoặc Video B-roll, áp dụng hiệu ứng *Ken Burns* (Dolly Zoom liên tục) bằng thuật toán `interpolate` của Remotion.
- 🎵 **AudioTrack**: Gắn file TTS `.mp3` vào trực tiếp timeline của Remotion.

### Phase 3: Xây dựng Template Động (Dynamic Sequences)
Thay vì các Slide chết, chúng ta dùng `<Sequence />` của Remotion.
- Mapping dữ liệu JSON từ Backend vào React.
- Scene 1 chạy từ giây 0 đến giây 3 (Timeline).
- Scene 2 chạy từ giây 3 đến giây 7...
- Giữa các `<Sequence />`, chèn các component chuyển cảnh (Transitions) xịn xò.

### Phase 4: Nối Cáp Backend (Tích hợp API)
- Viết lại hàm `record_template` trong `jobs.py`.
- Khi TTS xong, Backend tạo ra một file `props.json` chứa toàn bộ Kịch bản, Link Audio, Timings.
- Chạy lệnh CLI ngầm từ Python: 
  `npx remotion render src/index.ts MainVideo output/video_x.mp4 --props props.json`
- Lấy file `video_x.mp4` trả về cho User.

---

## TIẾP THEO BẠN MUỐN LÀM GÌ?
Đây là một cuộc đại phẫu. Tôi đề xuất chúng ta làm **Phase 1 & Phase 2** ngay bây giờ: Tạo dự án Remotion và viết cái Component **KineticTypography (Chữ nhảy theo giọng đọc)** đầu tiên. Bạn đồng ý chứ?
