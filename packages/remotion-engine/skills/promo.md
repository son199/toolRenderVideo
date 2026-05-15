---
name: promo
description: 20-30s promo / sản phẩm / giải pháp — hero + benefit + product + cta mạnh
niche: quảng cáo sản phẩm / dịch vụ / giải pháp
tone: persuasive, energetic
---

PHONG CÁCH NGHỆ THUẬT — PROMO:

- Đối tượng: người dùng tiềm năng — cần thuyết phục mua / đăng ký / download.
- Mood: tự tin, năng lượng, hấp dẫn. Tone giọng tích cực, đầy năng lượng.
- Visual language: ánh sáng sáng-tối tương phản, accent màu thương hiệu (xanh dương / cam / tím neon),
  ảnh sản phẩm rõ nét, motion mượt mà.
- Chữ ngắn, dứt khoát, từ khoá nổi bật. Caption.vi đầy đủ cho TTS, on-screen chỉ điểm nhấn.

NGUYÊN TẮC RIÊNG:
1. Scene 0 = `hero` (vấn đề / câu hỏi) HOẶC `stat` (con số lợi ích — "tiết kiệm 70%", "X người dùng").
2. PHẢI có ít nhất 1 scene `product` giới thiệu sản phẩm/giải pháp cụ thể (kèm visual rõ ràng).
3. Nên có 1 scene `comparison` "trước / sau" hoặc "cũ / mới" để chứng minh giá trị.
4. Scene cuối PHẢI là `cta` mạnh, kèm offer/deadline cụ thể ("dùng thử 7 ngày miễn phí", "ưu đãi 50% trong 48h").
5. Tổng thời lượng 18-30 giây — nhanh, gọn, đánh thẳng vào lợi ích.

ALLOWED SCENE TYPES (ưu tiên theo thứ tự):
- `hero`, `product`, `stat`, `comparison`, `list`, `kinetic`, `cta`

SEQUENCING PATTERN GỢI Ý:
- 5 scene: hero → product → comparison → stat → cta
- 6 scene: hero → stat → product → list → comparison → cta

EXAMPLE (5 scene rút gọn):
```json
{
  "scenes": [
    {"id":0,"type":"hero","duration_sec":2.5,
     "visual_prompt":"Frustrated person at desk surrounded by cluttered papers and old laptop, dim warm lighting, cinematic close-up, shallow depth of field",
     "text":"VẪN MẤT 3 GIỜ MỖI NGÀY?","caption":{"vi":"Bạn vẫn mất 3 tiếng mỗi ngày để làm việc này?"}},
    {"id":1,"type":"product","duration_sec":4.0,
     "visual_prompt":"Sleek modern dashboard UI on a floating glass display, neon blue accents, isometric view, glow rim light, 4k product shot",
     "text":"GỚI THIỆU AI ASSISTANT","caption":{"vi":"Giải pháp mới của chúng tôi tự động hoá toàn bộ trong vài giây."}},
    {"id":2,"type":"comparison","duration_sec":4.0,
     "visual_prompt":"Split-screen: left side messy spreadsheets and clocks ticking, right side clean automated dashboard with checkmarks, cinematic contrast",
     "text":"3 GIỜ → 3 PHÚT","caption":{"vi":"Từ 3 tiếng xuống chỉ còn 3 phút — không cần kỹ năng."}},
    {"id":3,"type":"stat","duration_sec":3.0,
     "visual_prompt":"Massive bold gold number rising from dark stage, particles floating up, spotlight effect, cinematic key light, 4k",
     "text":"10.000+","caption":{"vi":"Hơn mười nghìn người đã chuyển sang dùng."}},
    {"id":4,"type":"cta","duration_sec":2.5,
     "visual_prompt":"Bright modern call-to-action card with neon border, floating UI elements, energetic glow, cinematic end frame",
     "text":"DÙNG THỬ 7 NGÀY MIỄN PHÍ","caption":{"vi":"Dùng thử miễn phí 7 ngày tại trang chủ ngay hôm nay."}}
  ]
}
```
