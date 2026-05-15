---
name: news
description: 20-35s tech/news short — hook đanh + main number + comparison + cta
niche: tin tức / cập nhật / cảnh báo
tone: factual, urgent
---

PHONG CÁCH NGHỆ THUẬT — NEWS:

- Đối tượng: người xem TikTok/Reels muốn cập nhật nhanh trong 25-35 giây.
- Mood: khẩn cấp, đáng tin, có sức nặng. Tone giọng nhanh, đanh thép.
- Visual language: dark + accent color (đỏ cho danger, vàng cho warning),
  background động (server room / city / data viz), text uppercase ngắn gọn.
- Chữ trên màn hình phải LỚN, ngắn (≤8 từ/câu). Caption.vi đầy đủ cho TTS, text rút gọn.

NGUYÊN TẮC RIÊNG:
1. Scene 0 = `hero` HOẶC `stat` chứa hook gây sốc (con số + emoji 🚨/⚡/🔥).
2. Phải có ít nhất 1 scene `stat` với MAIN_NUMBER được phóng to.
3. Có thể dùng `comparison` để so sánh trước/sau, cũ/mới — rất phù hợp tin tức.
4. Scene cuối luôn là `cta` (link / hành động cụ thể / deadline).
5. Tổng thời lượng 20-35 giây.

ALLOWED SCENE TYPES (ưu tiên theo thứ tự):
- `hero`, `stat`, `comparison`, `kinetic`, `list`, `quote`, `cta`

SEQUENCING PATTERN GỢI Ý:
- 5 scene: hero → stat → comparison → kinetic → cta
- 7 scene: hero → stat → kinetic → comparison → stat → list → cta

EXAMPLE (4 scene rút gọn):
```json
{
  "scenes": [
    {"id":0,"type":"hero","duration_sec":2.5,
     "visual_prompt":"Cinematic close-up of a glowing red server rack at night, dramatic blue rim light, slow zoom in, 4k, hyper-real",
     "text":"🚨 CẢNH BÁO MỚI","caption":{"vi":"Cảnh báo: một lỗ hổng vừa được phát hiện."}},
    {"id":1,"type":"stat","duration_sec":3.0,
     "visual_prompt":"Abstract data visualization, glowing orange numbers floating in dark space, particle field, depth of field, 4k",
     "text":"450 TRIỆU","caption":{"vi":"Có tới 450 triệu thiết bị đang chịu rủi ro."}},
    {"id":2,"type":"comparison","duration_sec":4.0,
     "visual_prompt":"Split-screen contrast: left side dim office with old laptop, right side bright modern server room with glowing cables, cinematic",
     "text":"TRƯỚC // SAU","caption":{"vi":"Trước đây an toàn — bây giờ tất cả đã thay đổi."}},
    {"id":3,"type":"cta","duration_sec":2.5,
     "visual_prompt":"Glowing call-to-action banner over dark gradient background, neon accent, floating particles, cinematic end card",
     "text":"CẬP NHẬT NGAY","caption":{"vi":"Cập nhật ngay tại trang chủ trong 24 giờ tới."}}
  ]
}
```
