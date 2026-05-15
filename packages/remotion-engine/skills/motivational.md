---
name: motivational
description: 25-40s motivational / inspiring — hero question + quote + reflection + cta nhẹ
niche: cảm hứng / tự phát triển / suy ngẫm
tone: inspiring, reflective
---

PHONG CÁCH NGHỆ THUẬT — MOTIVATIONAL:

- Đối tượng: người xem cần inspiration / suy ngẫm — kéo dài chú ý bằng câu chuyện và quote.
- Mood: tĩnh lặng, sâu lắng, ấm áp HOẶC bùng nổ ở khúc CTA. Tone giọng chậm, nhấn nhá.
- Visual language: ánh sáng natural / golden hour, cảnh wide (núi, biển, thành phố ban đêm),
  serif font, ít chữ trên màn hình.
- Caption.vi đầy đủ cho TTS đọc trọn câu, text trên màn hình tinh giản (≤6 từ/scene non-quote).

NGUYÊN TẮC RIÊNG:
1. Scene 0 = `hero` hoặc `quote` với câu hỏi gợi suy ngẫm ("Bạn đã thử...?", "Điều gì khiến...?").
2. Phải có ≥1 scene `quote` (lời chuyên gia / câu nói nổi tiếng / khẳng định mạnh).
3. Tránh dùng nhiều `stat` — không phải video số liệu. Tối đa 1 `stat` nếu thật sự cần.
4. Có thể chèn `list` (3-5 bullet) ở giữa để truyền tải nhanh các bước / nguyên tắc.
5. Scene cuối là `cta` NHẸ — gợi mở, không hard-sell ("hãy bắt đầu hôm nay", "chia sẻ với người bạn cần").
6. Tổng thời lượng 25-40 giây — chậm hơn news/promo, để cảm xúc lan toả.

ALLOWED SCENE TYPES (ưu tiên theo thứ tự):
- `hero`, `quote`, `kinetic`, `list`, `comparison`, `stat`, `cta`

SEQUENCING PATTERN GỢI Ý:
- 5 scene: hero → quote → kinetic → list → cta
- 6 scene: hero → kinetic → quote → comparison → kinetic → cta

EXAMPLE (5 scene rút gọn):
```json
{
  "scenes": [
    {"id":0,"type":"hero","duration_sec":3.5,
     "visual_prompt":"Lone figure standing on a cliff watching golden sunrise over mountains, wide cinematic shot, soft warm light, anamorphic lens flare",
     "text":"BẠN ĐÃ TỪNG TỰ HỎI?","caption":{"vi":"Bạn đã bao giờ tự hỏi mình thực sự đang đi về đâu chưa?"}},
    {"id":1,"type":"quote","duration_sec":5.0,
     "visual_prompt":"Soft minimal background, paper texture, vintage typography spotlight, warm tone, dreamy bokeh, 4k cinematic",
     "text":"Hành trình ngàn dặm bắt đầu từ một bước chân.","caption":{"vi":"Hành trình ngàn dặm bắt đầu từ chỉ một bước chân. — Lão Tử."}},
    {"id":2,"type":"kinetic","duration_sec":5.5,
     "visual_prompt":"Slow motion person walking through misty forest at dawn, dappled light filtering through trees, cinematic Steadicam, shallow depth",
     "text":"BẮT ĐẦU NHỎ THÔI","caption":{"vi":"Đừng đợi hoàn hảo — hãy bắt đầu nhỏ, từng bước một, mỗi ngày."}},
    {"id":3,"type":"list","duration_sec":6.0,
     "visual_prompt":"Three glowing icons hovering over a serene lake at twilight, soft reflection on water, magical realism, cinematic",
     "text":"BA NGUYÊN TẮC","caption":{"vi":"Ba nguyên tắc: kiên nhẫn, kỷ luật, và biết ơn mỗi ngày."}},
    {"id":4,"type":"cta","duration_sec":3.0,
     "visual_prompt":"Warm campfire glow at night with stars above, soft inviting tone, cinematic end card, gentle particles",
     "text":"BẮT ĐẦU HÔM NAY","caption":{"vi":"Hãy bắt đầu hôm nay — và chia sẻ với một người bạn cần lời nhắc này."}}
  ]
}
```
