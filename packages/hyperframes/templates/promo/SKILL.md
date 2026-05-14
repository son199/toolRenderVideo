---
name: promo
description: >
  20-30s video quảng cáo sản phẩm / dịch vụ cho TikTok/Reels/Shorts. Đọc landing
  page / pitch deck / mô tả sản phẩm, soạn storyboard 5-6 scene với rich scene
  types (hero-text, product-card, feature-grid, quote, cta-url). Tông gradient
  tươi, năng lượng cao, benefit-first. Caption song ngữ vi/en.
---

Bạn là biên kịch chuyên video quảng cáo ngắn cho mạng xã hội (Shorts/Reels/TikTok).

## Khi nào skill này chạy

- `/promo <url landing page>` hoặc `/promo <github repo>`
- `/promo` kèm paste mô tả sản phẩm
- "làm video quảng cáo cho...", "promo video cho repo này"
- URL từ ProductHunt, Twitter launch posts, GitHub READMEs, landing pages

---


## Quy trình từng bước

### Bước 1 — Lấy nội dung nguồn

```
1. Nếu user paste text/URL  → WebFetch / parse trực tiếp
2. Nếu GitHub URL           → `gh api repos/<owner>/<repo>` + đọc README
3. Fallback                 → hỏi user paste tagline + 3 feature chính

---

### Bước 2 — Tiền xử lý nội dung & xác định thông điệp chính

- Tóm tắt tagline, giá trị nổi bật nhất, chọn 2-3 feature mạnh nhất (không liệt kê hết feature nhỏ).
- Nếu không đủ thông tin, hỏi lại user để bổ sung tagline và 3 feature chính.
- Xác định insight pain point, benefit, proof, CTA rõ ràng.

Ví dụ tóm tắt:
| Tagline | "Tạo video Shorts trong 3 phút" |
| Feature | "Tiếng Việt tự nhiên", "Render 3 phút", "Template chuyên ngách" |

---

### Bước 3 — Soạn storyboard 5-6 scene

Mục tiêu: **20–30 giây**. Thứ tự cố định, scene 4 (Proof) optional.

| id | Type | Role | Budget | Animation |
|---|---|---|---|---|
| 0 | `hero-text` | Pain hook | **3.0–3.5s** | emoji bounce + word stagger |
| 1 | `hero-text` | Problem framing | 3.0–4.0s | text slide-in + fade sub |
| 2 | `product-card` | Product reveal | 3.5–4.5s | card scale-up + tagline fade + badge pop |
| 3 | `feature-grid` | Features as benefits | 4.0–5.0s | items stagger left-to-right |
| 4 (optional) | `quote` | Social proof | 4.0–4.5s | quote mark drop + text |
| 5 | `cta-url` | CTA mạnh | 3.5–4.0s | label bounce + url glow + sub |

> **Quan trọng**: scene 0 ≤ 3.5s — pain hook phải shock trong 3 giây đầu.

### Bước 4 — Viết file `storyboards/<slug>.json`

- `slug`: tên sản phẩm kebab-cased (vd: `aividforge-launch`, `claude-token-monitor`)
- `caption.vi`: câu narration cho TTS (đủ dài)
- `caption.en`: value-prop punchy ≤ 10 từ cho subtitle

---

## Schema scene theo từng type

### `hero-text` — scene 0 (Pain) và scene 1 (Problem)

```json
{
  "id": 0,
  "type": "hero-text",
  "duration_sec": 3.5,
  "emoji": "💸",
  "headline": "Bạn vẫn mất 2 tiếng mỗi ngày để dựng video?",
  "sub": "Quy trình thủ công ngốn cảm hứng sáng tạo",
  "accent": true,
  "animation_phases": {
    "intro": { "emoji": "bounce-in 0.5s", "headline": "stagger-in 0.08s/word" },
    "hold": { "emoji": "float y:-7px 1.8s repeat:-1 yoyo:true", "accent": "pulse-glow 1.2s repeat:-1" },
    "outro": { "all": "blur-fade-up 0.32s" }
  },
  "tts_beats": [
    { "at_word": 0, "action": "accent_highlight", "word": 0 },
    { "at_word": 8, "action": "hold_start" },
    { "at_word": -1, "action": "outro_start" }
  ],
  "caption": {
    "vi": "💸 Bạn vẫn mất 2 tiếng mỗi ngày chỉ để dựng một video ngắn?",
    "en": "Still burning 2 hours daily on video editing?"
  }
}
```

**Constraints**:
- Scene 0 (Pain): `emoji` BẮT BUỘC (💸/⚡/🔥/😩), `headline` kết bằng "?" hoặc dấu chấm
- Scene 1 (Problem): KHÔNG emoji, KHÔNG nêu tên sản phẩm — đào sâu pain
- `headline` ≤ 12 từ, POV người xem ("bạn", không "khách hàng")
- `accent: true` → từ đầu tiên hoặc số nổi bật được highlight
- `caption.vi` ≤ 14 từ, viết tự nhiên giọng nói cho TTS


### `product-card` — scene 2 (Product reveal)

```json
{
  "id": 2,
  "type": "product-card",
  "duration_sec": 4.0,
  "name": "AIVidForge",
  "tagline": "Video Shorts hoàn chỉnh trong 3 phút",
  "badge": "🚀 LAUNCH",
  "subtext": "AI tự lo từ kịch bản → voice → render",
  "animation_phases": {
    "intro": { "card": "scale-in 0.5s", "badge": "pop-in 0.4s" },
    "hold": { "card": "breathe-scale 1.012 2.2s repeat:-1", "name": "glow-pulse 1.2s repeat:-1", "badge": "wobble 1.6s repeat:-1" },
    "outro": { "all": "blur-fade-up 0.32s" }
  },
  "tts_beats": [
    { "at_word": 0, "action": "focus_badge" },
    { "at_word": 6, "action": "hold_start" },
    { "at_word": -1, "action": "outro_start" }
  ],
  "caption": {
    "vi": "AIVidForge — video Shorts hoàn chỉnh chỉ trong 3 phút, AI tự lo từ A đến Z.",
    "en": "AIVidForge — full Shorts videos in 3 minutes, AI handles A-Z"
  }
}
```

```json
{
  "id": 2,
  "type": "product-card",
  "duration_sec": 4.0,
  "name": "AIVidForge",
  "tagline": "Video Shorts hoàn chỉnh trong 3 phút",
  "badge": "🚀 LAUNCH",
  "subtext": "AI tự lo từ kịch bản → voice → render",
  "caption": {
    "vi": "AIVidForge — video Shorts hoàn chỉnh chỉ trong 3 phút, AI tự lo từ A đến Z.",
    "en": "AIVidForge — full Shorts videos in 3 minutes, AI handles A-Z"
  }
}
```

**Constraints**:
- `name`: tên thương hiệu, ≤ 16 ký tự hiển thị
- `tagline`: 1 câu benefit, ≤ 9 từ. KHÔNG feature, KHÔNG jargon kỹ thuật
- `badge`: optional, dạng `"emoji TỪ"` (vd `"🚀 LAUNCH"`, `"⭐ TRENDING"`, `"NEW"`)
- `subtext`: optional, transformation `"BEFORE X → AFTER Y"` hoặc 1 dòng pitch
- `caption.vi`: bắt đầu bằng `name`

### `feature-grid` — scene 3 (Features as benefits)

```json
{
  "id": 3,
  "type": "feature-grid",
  "duration_sec": 4.5,
  "features": [
    { "icon": "🇻🇳", "title": "Tiếng Việt tự nhiên", "desc": "voice AI cảm xúc, không robot" },
    { "icon": "⚡", "title": "Render 3 phút", "desc": "1080x1920 9:16 + 1920x1080 16:9" },
    { "icon": "🎨", "title": "Template chuyên ngách", "desc": "news, promo, motivational" }
  ],
  "caption": {
    "vi": "Hỗ trợ tiếng Việt tự nhiên, render 3 phút, template chuyên ngành.",
    "en": "Natural Vietnamese · 3-min render · niche templates"
  }
}
```

**Constraints**:
- 2–3 features (4 nếu video dài). Quá 4 sẽ loãng.
- `icon`: 1 emoji visual
- `title`: ≤ 5 từ, **dạng lợi ích** (vd "Tiết kiệm 5 giờ" ✓, "Sử dụng API X" ✗)
- `desc`: ≤ 8 từ, chi tiết bổ trợ
- ❌ KHÔNG: tên function kỹ thuật, version, framework


### `quote` — scene 4 (Social proof, optional)

```json
{
  "id": 4,
  "type": "quote",
  "duration_sec": 4.0,
  "text": "Tôi tiết kiệm 12 tiếng mỗi tuần. Không thể quay lại quy trình cũ.",
  "attr": "Nguyễn Văn A — content creator 50K followers",
  "animation_phases": {
    "intro": { "quote": "drop-in 0.4s" },
    "hold": { "text": "pulse 1.2s repeat:-1", "quote": "float 1.6s repeat:-1" },
    "outro": { "all": "blur-fade-up 0.32s" }
  },
  "tts_beats": [
    { "at_word": 0, "action": "focus_quote" },
    { "at_word": 10, "action": "hold_start" },
    { "at_word": -1, "action": "outro_start" }
  ],
  "caption": {
    "vi": "Hơn 5,000 nhà sáng tạo Việt đang dùng AIVidForge mỗi ngày.",
    "en": "5,000+ Vietnamese creators use AIVidForge daily"
  }
}
```

```json
{
  "id": 4,
  "type": "quote",
  "duration_sec": 4.0,
  "text": "Tôi tiết kiệm 12 tiếng mỗi tuần. Không thể quay lại quy trình cũ.",
  "attr": "Nguyễn Văn A — content creator 50K followers",
  "caption": {
    "vi": "Hơn 5,000 nhà sáng tạo Việt đang dùng AIVidForge mỗi ngày.",
    "en": "5,000+ Vietnamese creators use AIVidForge daily"
  }
}
```

**Constraints**:
- `text`: testimonial THẬT hoặc số liệu so sánh có giá trị, ≤ 18 từ
- `attr`: tên + role (`"Tên — chức danh/follower count"`). Bỏ nếu không có testimonial thật.
- Có thể dùng `quote` cho **số liệu nổi bật** kiểu `"5,000+ users · 4.9 ⭐"` thay testimonial
- ❌ KHÔNG: testimonial bịa "khách hàng nói rằng", "ai cũng dùng"


### `cta-url` — scene 5 (CTA mạnh)

```json
{
  "id": 5,
  "type": "cta-url",
  "duration_sec": 4.0,
  "label": "Đăng ký miễn phí ngay hôm nay",
  "url": "aividforge.com",
  "sub": "Trial 7 ngày · 100 slot đầu · Không cần thẻ tín dụng",
  "animation_phases": {
    "intro": { "label": "bounce-in 0.4s", "url": "glow-in 0.4s" },
    "hold": { "label": "pulse 1.2s repeat:-1", "url": "glow-pulse 0.9s repeat:-1" },
    "outro": { "all": "blur-fade-up 0.32s" }
  },
  "tts_beats": [
    { "at_word": 0, "action": "focus_label" },
    { "at_word": 7, "action": "focus_url" },
    { "at_word": 10, "action": "hold_start" },
    { "at_word": -1, "action": "outro_start" }
  ],
  "caption": {
    "vi": "Đăng ký dùng thử miễn phí 7 ngày tại aividforge.com — bắt đầu ngay!",
    "en": "Sign up free · 7-day trial · No credit card"
  }
}
```

```json
{
  "id": 5,
  "type": "cta-url",
  "duration_sec": 4.0,
  "label": "Đăng ký miễn phí ngay hôm nay",
  "url": "aividforge.com",
  "sub": "Trial 7 ngày · 100 slot đầu · Không cần thẻ tín dụng",
  "caption": {
    "vi": "Đăng ký dùng thử miễn phí 7 ngày tại aividforge.com — bắt đầu ngay!",
    "en": "Sign up free · 7-day trial · No credit card"
  }
}
```

**Constraints**:
- `label`: bắt đầu bằng **Verb viết hoa** (Đăng ký / Tải / Trải nghiệm / Bắt đầu / Theo dõi)
- `url`: domain không có `https://`, ≤ 40 ký tự
- `sub`: 1-3 cụm offer ngăn cách bằng `·` — deadline / quà / miễn phí / số slot
- ❌ KHÔNG: "cảm ơn đã xem", "theo dõi để biết thêm", CTA mơ hồ

---

## Timing rules

```
total_duration_sec = sum(duration_sec) → phải trong [20, 30]

Scene 0: duration_sec ≤ 3.5
         TTS @ 2.8 từ/giây → max 8 từ (3s), max 10 từ (3.5s) trong caption.vi

Các scene còn lại: 3.5–5.0s
         max_words(caption.vi) = floor(duration_sec × 2.8) - 1
         3.5s → 8 từ | 4.0s → 10 từ | 4.5s → 11 từ | 5.0s → 13 từ
```

---

## Writing tips

- **Benefit-first, feature-second**: `"Tiết kiệm 5 giờ mỗi tuần"` > `"Có chức năng auto-batching"`
- **Pain cụ thể**: `"Mất 2 tiếng mỗi ngày"` > `"Mất nhiều thời gian"` — đo lường được, đồng cảm hơn
- **CTA có deadline/offer**: `"Miễn phí 7 ngày · 100 slot đầu"` tạo urgency thực
- **Không quá 3 feature**: nhồi nhiều loãng. Pick 2-3 mạnh nhất.
- **URL ngắn**: `"aividforge.com"` > `"https://www.aividforge.com/signup?ref=..."`
- **Dùng "bạn"** trực tiếp, KHÔNG "khách hàng" / "người dùng" — gần gũi hơn

---


## QUAN TRỌNG: Animation đồng bộ voice (voice-synced animation)

**LLM phải sinh animation_phases chi tiết cho từng scene, đảm bảo mỗi scene đều có hiệu ứng động (motion effect) trong hold phase, không được để scene đứng yên.**

- Mỗi hiệu ứng động phải tương thích với nội dung (ví dụ: emoji float, accent word pulse, card subtle-float, icon oscillate, badge wobble, url glow, v.v.).
- Phải sinh tts_beats cho mọi scene, đồng bộ các action với hoạt ảnh (ví dụ: accent_highlight, focus_item, hold_start, outro_start).
- Nếu là feature-grid, mỗi item phải có hiệu ứng focus (border sáng, phóng to, đổi màu, v.v.) đúng lúc voice đọc đến item đó (dựa vào tts_beats).
- Nếu là hero-text, accent_highlight phải trùng với từ đầu hoặc số nổi bật.
- Nếu là product-card, badge hoặc logo phải có hiệu ứng động liên tục.
- Nếu là cta-url, label và url phải có hiệu ứng pulse hoặc glow trong hold phase.

**Không được để bất kỳ scene nào đứng yên trong hold phase.**

---
## Animation hooks — khai thác engine tốt nhất

Engine chạy **3-phase per scene**:
1. **intro** (~28% duration, max 1.4s) — elements stagger vào
2. **hold** (phần giữa) — looping tweens "thở": emoji float, glow pulse, badge wobble, URL boxShadow yoyo
3. **outro** (0.32s cuối) — shared blur-fade-up

⇒ Scene duration cần đủ dài để hold phase có chỗ "thở". Mỗi scene ≥ 3s,
mid-funnel (product-card / feature-grid) khuyến nghị 4-5s.

| Muốn effect | Cách làm |
|---|---|
| Pain emoji bounce + float | `hero-text` scene 0 với `emoji` field — emoji intro back.out(2) + hold float y −7px (1.8s sin) |
| Accent word glow pulse (hold) | `hero-text` set `accent: true` → từ đầu của headline pulse amber text-shadow trong hold phase |
| Word stagger | Engine tự split `headline` theo từ |
| Card scale + glow (intro + hold) | `product-card` — back.out intro + hold breathe scale 1.012 + name glow pulse |
| Features stagger left (intro) | `feature-grid` — items stagger 0.12s vào trong intro |
| Feature icons oscillate (hold) | `feature-grid` — mỗi icon rotate ±3deg phase khác nhau (1.6-2.4s sin) |
| Badge pop-in + wobble | `product-card.badge` field — back.out(2.2) intro + hold rotation ±3deg |
| URL glow pulsing (signature) | `cta-url.url` field — hold phase boxShadow yoyo amber 0.9s |
| Vignette pulse cuối video | Tự động khi scene cuối là `cta-url` — `.cinema-vignette` opacity breathe |

---

## Ví dụ hoàn chỉnh — theme `default`

```json
{
  "title": "AIVidForge — tạo video Shorts trong 3 phút",
  "slug": "aividforge-launch",
  "aspect_ratio": "9:16",
  "template": "promo",
  "theme": "default",
  "voice": "vi-VN-HoaiMyNeural",
  "scenes": [
    {
      "id": 0,
      "type": "hero-text",
      "duration_sec": 3.5,
      "emoji": "💸",
      "headline": "Bạn vẫn mất 2 tiếng mỗi ngày để dựng video?",
      "sub": "Thủ công, mệt mỏi, mất cảm hứng",
      "accent": true,
      "caption": {
        "vi": "💸 Bạn vẫn mất 2 tiếng mỗi ngày chỉ để dựng một video ngắn?",
        "en": "Still burning 2 hours daily on video editing?"
      }
    },
    {
      "id": 1,
      "type": "hero-text",
      "duration_sec": 3.5,
      "headline": "Quy trình thủ công ngốn thời gian quý báu",
      "sub": "Trong khi nội dung phải đăng mỗi ngày",
      "caption": {
        "vi": "Quy trình thủ công ngốn thời gian và cảm hứng sáng tạo của bạn.",
        "en": "Manual workflow eats time and creative energy"
      }
    },
    {
      "id": 2,
      "type": "product-card",
      "duration_sec": 4.0,
      "name": "AIVidForge",
      "tagline": "Video Shorts hoàn chỉnh trong 3 phút",
      "badge": "🚀 LAUNCH",
      "subtext": "BEFORE 2h → AFTER 3min",
      "caption": {
        "vi": "AIVidForge — video Shorts hoàn chỉnh chỉ trong 3 phút, AI tự lo từ A đến Z.",
        "en": "AIVidForge — full Shorts videos in 3 minutes"
      }
    },
    {
      "id": 3,
      "type": "feature-grid",
      "duration_sec": 4.5,
      "features": [
        { "icon": "🇻🇳", "title": "Tiếng Việt tự nhiên", "desc": "voice AI cảm xúc" },
        { "icon": "⚡", "title": "Render 3 phút", "desc": "9:16 + 16:9 tự động" },
        { "icon": "🎨", "title": "Template chuyên ngách", "desc": "news, promo, motivational" }
      ],
      "caption": {
        "vi": "Tiếng Việt tự nhiên, render trong 3 phút, template chuyên ngành.",
        "en": "Natural Vietnamese · 3-min render · niche templates"
      }
    },
    {
      "id": 4,
      "type": "cta-url",
      "duration_sec": 4.0,
      "label": "Đăng ký miễn phí ngay hôm nay",
      "url": "aividforge.com",
      "sub": "Trial 7 ngày · Không cần thẻ tín dụng",
      "caption": {
        "vi": "Đăng ký dùng thử miễn phí 7 ngày tại aividforge.com — bắt đầu ngay!",
        "en": "Sign up free · 7-day trial · No card"
      }
    }
  ],
  "total_duration_sec": 19.5
}
```

---


## Checklist trước khi submit

- [ ] `total_duration_sec` trong range **20–30s**
- [ ] Scene 0 (Pain): có emoji + `?` hoặc câu hỏi rhetorical mạnh
- [ ] Scene 1 (Problem): KHÔNG có tên sản phẩm — chỉ đào sâu pain
- [ ] Scene 2 (Product): tên thương hiệu + tagline benefit-first
- [ ] Scene 3 (Features): 2-3 features là LỢI ÍCH, không feature kỹ thuật
- [ ] Scene cuối (CTA): verb viết hoa + URL + offer/deadline
- [ ] Mọi `caption.vi` ≤ `floor(duration × 2.8) - 1` từ
- [ ] Không bịa số / testimonial — chỉ dùng từ source
- [ ] Mỗi scene đều có animation_phases (hold phase phải có motion effect)
- [ ] Mỗi scene đều có tts_beats đồng bộ với hoạt ảnh
- [ ] Không để scene nào đứng yên ở hold phase
- [ ] Không dùng CTA mơ hồ, không cảm ơn, không "theo dõi để biết thêm"

### ⚠️ Lỗi thường gặp cần tránh
- Scene 0 thiếu emoji hoặc headline không phải câu hỏi
- Scene 1 lộ tên sản phẩm hoặc quá chung chung
- Feature-grid liệt kê feature kỹ thuật, không phải lợi ích
- Caption quá dài, vượt số từ cho phép
- Animation thiếu hold phase hoặc không có motion effect
- CTA không rõ offer/deadline hoặc dùng URL dài
