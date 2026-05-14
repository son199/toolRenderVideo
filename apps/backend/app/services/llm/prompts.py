"""System + user prompt builders for storyboard generation.

`build_system_prompt(template)` returns the per-niche SKILL.md body + a
template-aware JSON schema block containing ONLY the scene types relevant
to that niche. Eg: promo gets product-card/feature-grid but not terminal;
motivational gets question-hero/closing-card but not stats-grid.

Per-niche timing rules live in SKILL.md — the schema block does not hardcode
duration ranges so SKILL.md remains the single source of truth for pacing.
"""

from __future__ import annotations

from app.services.skills import load_skill

# ============================================================
# Per-type schema blocks
#
# Each block teaches the LLM the exact JSON shape for that scene type.
# Type-specific fields are listed inline; common fields (id, duration_sec,
# voice, visual_prompt, caption) are referenced by the outer schema.
# ============================================================

_TYPE_HERO_TEXT = """\
**hero-text** — hook hoặc impact statement (1 emoji + headline ngắn):
{
  "id": 0, "type": "hero-text", "duration_sec": 3.5,
  "emoji": "🚨",                  // 1 emoji bắt mắt phù hợp theme
  "headline": "Tiêu đề ≤ 9 từ",   // KHÔNG emoji ở đây (emoji có field riêng)
  "sub": "Context ≤ 8 từ",        // optional, không lặp headline
  "accent": true,                 // true → từ đầu tiên highlight amber
  "visual_prompt": "mô tả hình ảnh nền 1-2 câu",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": {
    "vi": "Câu narration đầy đủ cho TTS",
    "en": "Punchy EN subtitle ≤ 10 words"
  }
}"""

_TYPE_STATS_GRID = """\
**stats-grid** — số liệu then chốt (2-4 cards):
{
  "id": 1, "type": "stats-grid", "duration_sec": 5.0,
  "stats": [
    { "big": "12,000", "label": "hồ sơ bị mã hoá" },
    { "big": "450M USD", "label": "tiền chuộc", "accent": true },
    { "big": "72h", "label": "chưa khôi phục" }
  ],
  // big: ≤ 8 ký tự hiển thị (vd "1.2M", "72h", "#1"). label: ≤ 5 từ lowercase.
  // accent: true trên 1 card quan trọng nhất.
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": {
    "vi": "Narration dùng dấu chấm ngăn pairs",
    "en": "EN subtitle"
  }
}"""

_TYPE_TERMINAL = """\
**terminal** — chi tiết kỹ thuật / log / dòng lệnh (3-6 lines):
{
  "id": 2, "type": "terminal", "duration_sec": 4.5,
  "title": "tên terminal ≤ 30 ký tự (vd 'exploit — CVE-2026-1234')",
  "lines": [
    { "type": "prompt",  "text": "lệnh thực thi (≤ 60 ký tự để không wrap)" },
    { "type": "error",   "text": "lỗi / cảnh báo" },
    { "type": "success", "text": "kết quả thành công" },
    { "type": "output",  "text": "output thông thường" }
  ],
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration kỹ thuật", "en": "EN subtitle" }
}"""

_TYPE_CODE_DIFF = """\
**code-diff** — before/after fix (2 panels):
{
  "id": 3, "type": "code-diff", "duration_sec": 5.0,
  "badLabel": "✗ vulnerable",
  "bad": "from jinja2 import Environment\\n\\nenv = Environment()\\n# arbitrary exec",
  "goodLabel": "✓ fixed",
  "good": "from jinja2.sandbox import \\\\\\n    ImmutableSandboxedEnvironment\\n\\nenv = ImmutableSandboxedEnvironment()\\n# safe render",
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration giải thích diff", "en": "EN subtitle" }
}"""

_TYPE_QUOTE = """\
**quote** — quote xác thực từ nguồn chính thức:
{
  "id": 4, "type": "quote", "duration_sec": 4.5,
  "text": "Câu phát biểu trực tiếp ≤ 18 từ",
  "attr": "TÊN NGUỒN — YYYY-MM-DD",  // CISA / FBI / Microsoft / tên người thật
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration quote", "en": "EN subtitle" }
}"""

_TYPE_CTA_URL = """\
**cta-url** — call-to-action scene cuối:
{
  "id": 5, "type": "cta-url", "duration_sec": 4.0,
  "label": "Verb viết hoa + hành động (Cập nhật / Vá / Tải / Đăng ký)",
  "url": "domain.com/path (KHÔNG có https://, ≤ 50 ký tự)",
  "sub": "Deadline cụ thể HOẶC tên nguồn (vd 'Trong 48 giờ · KB5034441')",
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration CTA", "en": "EN subtitle" }
}"""

# ----- Promo-specific types -----

_TYPE_PRODUCT_CARD = """\
**product-card** — product reveal (brand + tagline + optional badge):
{
  "id": 2, "type": "product-card", "duration_sec": 4.0,
  "name": "Tên thương hiệu ≤ 16 ký tự",
  "tagline": "1 câu benefit ≤ 9 từ — KHÔNG feature kỹ thuật",
  "badge": "🚀 LAUNCH",  // optional: emoji + 1 từ viết hoa
  "subtext": "BEFORE 2h → AFTER 3min",  // optional: transformation 1-line
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": {
    "vi": "Narration bắt đầu bằng `name`",
    "en": "EN subtitle"
  }
}"""

_TYPE_FEATURE_GRID = """\
**feature-grid** — features as benefits (2-4 items):
{
  "id": 3, "type": "feature-grid", "duration_sec": 4.5,
  "features": [
    { "icon": "🇻🇳", "title": "Tiếng Việt tự nhiên", "desc": "voice AI cảm xúc" },
    { "icon": "⚡", "title": "Render 3 phút", "desc": "9:16 + 16:9 tự động" },
    { "icon": "🎨", "title": "Template chuyên ngách", "desc": "news, promo, ..." }
  ],
  // title ≤ 5 từ DẠNG LỢI ÍCH (không jargon). desc ≤ 8 từ chi tiết bổ trợ.
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration tóm tắt features", "en": "EN subtitle" }
}"""

# ----- Motivational-specific types -----

_TYPE_QUESTION_HERO = """\
**question-hero** — câu hỏi mở scene 0 (POV thân mật):
{
  "id": 0, "type": "question-hero", "duration_sec": 6.0,
  "question": "Câu hỏi mở 8-15 từ, KẾT BẰNG '?'",
  "emoji": "☕",  // optional: 1 emoji warm (☕/🌅/🍃/✨/🪴)
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration đúng câu hỏi", "en": "EN subtitle" }
}"""

_TYPE_LINE_STATEMENT = """\
**line-statement** — 1 câu giàu hình ảnh (Bối cảnh + Insight):
{
  "id": 1, "type": "line-statement", "duration_sec": 6.5,
  "line": "Câu duy nhất 10-22 từ, giàu hình ảnh, không sáo rỗng",
  "emphasis": "từ key",  // optional: 1-2 từ trong line để italic + amber glow
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration đúng line", "en": "EN subtitle" }
}"""

_TYPE_QUOTE_CARD = """\
**quote-card** — quote với attribution thật:
{
  "id": 3, "type": "quote-card", "duration_sec": 6.0,
  "text": "Quote thật ≤ 22 từ",
  "attr": "Tên tác giả — Nguồn (vd 'James Clear — Atomic Habits')",
  // Nếu không có quote thật → khẳng định của riêng + để attr = ""
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration trích dẫn", "en": "EN subtitle" }
}"""

_TYPE_CLOSING_CARD = """\
**closing-card** — CTA mềm kết video (KHÔNG bán hàng, không URL):
{
  "id": 4, "type": "closing-card", "duration_sec": 5.5,
  "line": "Gợi ý 1 bước nhỏ cụ thể",
  "footer": "— Tagline kết —",  // optional
  "visual_prompt": "...",
  "voice": "vi-VN-HoaiMyNeural",
  "caption": { "vi": "Narration CTA mềm", "en": "EN subtitle" }
}"""


# ============================================================
# Per-template type whitelist
#
# When a template generates a storyboard, only these types are allowed.
# Reviewer (rubric A5) flags any scene whose type isn't in this list.
# ============================================================

_TEMPLATE_TYPES: dict[str, list[str]] = {
    "news": [
        _TYPE_HERO_TEXT, _TYPE_STATS_GRID, _TYPE_TERMINAL,
        _TYPE_CODE_DIFF, _TYPE_QUOTE, _TYPE_CTA_URL,
    ],
    "promo": [
        _TYPE_HERO_TEXT, _TYPE_PRODUCT_CARD, _TYPE_FEATURE_GRID,
        _TYPE_QUOTE, _TYPE_CTA_URL,
    ],
    "motivational": [
        _TYPE_QUESTION_HERO, _TYPE_LINE_STATEMENT,
        _TYPE_QUOTE_CARD, _TYPE_CLOSING_CARD,
    ],
}


# ============================================================
# Outer schema + universal rules
# ============================================================

_OUTER_SCHEMA = """\
=== OUTPUT FORMAT (BẮT BUỘC) ===
Trả về JSON THUẦN — không markdown, không giải thích.

Cấu trúc ngoài cùng:
{
  "title": "string, tiêu đề video ≤ 80 ký tự",
  "aspect_ratio": "9:16" | "16:9",
  "template": "string, id template",
  "scenes": [ ...mỗi scene đúng 1 trong các type bên dưới... ],
  "total_duration_sec": 25.5
}"""

_UNIVERSAL_RULES = """\
=== QUY TẮC BẮT BUỘC (áp dụng MỌI scene) ===
- Mỗi scene PHẢI có field `type` đúng 1 trong các value liệt kê ở trên cho ngách này.
- Mỗi scene PHẢI có `caption.vi` (nguồn TTS) VÀ `caption.en` (subtitle).
- `scenes[].id` đánh số liên tiếp từ 0, KHÔNG nhảy số, KHÔNG trùng.
- `total_duration_sec` = tổng `duration_sec` của tất cả scenes (sai số ≤ 0.1s).
- Type-specific fields (emoji/headline/stats/lines/features/question/line/...)
  PHẢI có mặt đúng theo schema của type đó — không bỏ qua.
- Duration / pacing cụ thể theo SKILL.md của ngách (mục "Timing rules" / "Cấu trúc").
"""


_GENERIC_SYSTEM_PROMPT = """\
Bạn là biên kịch chuyên sản xuất video ngắn cho mạng xã hội (Shorts, Reels, TikTok).
Nhiệm vụ: chuyển nội dung đầu vào thành storyboard 4-7 scenes, tổng 20-60 giây.

Quy tắc chung:
1. Mỗi scene 1 câu narration ngắn (10-25 từ tiếng Việt), dễ đọc thành tiếng.
2. visual_prompt mô tả hình ảnh nền cho scene (1-2 câu).
3. Mở đầu phải có hook, kết thúc có call-to-action hoặc câu chốt.
4. Ngôn ngữ trùng với nội dung đầu vào (mặc định: tiếng Việt)."""


def _build_schema_block(template: str, type_schemas: list[str]) -> str:
    """Compose the template-aware JSON schema block.

    Wraps outer structure + only the type schemas relevant to `template` +
    universal rules. Per-niche timing/pacing lives in SKILL.md — this block
    intentionally does NOT hardcode duration ranges.
    """
    types_section = "\n\n".join(type_schemas)
    return (
        f"{_OUTER_SCHEMA}\n\n"
        f"=== SCENE TYPES CHO NGÁCH '{template}' (chỉ dùng các type này) ===\n\n"
        f"{types_section}\n\n"
        f"{_UNIVERSAL_RULES}"
    )


def build_system_prompt(template: str) -> str:
    """Compose the system prompt for `template`.

    Layout: SKILL.md body (per-niche storytelling rules + timing) + outer
    schema + ONLY the type schemas relevant to this template + universal rules.
    """
    skill = load_skill(template)
    head = skill.system_prompt if skill else _GENERIC_SYSTEM_PROMPT
    types_for_template = _TEMPLATE_TYPES.get(template) or _TEMPLATE_TYPES["news"]
    schema_block = _build_schema_block(template, types_for_template)
    return f"{head}\n\n{schema_block}"


def build_user_prompt(
    *,
    text: str,
    template: str,
    aspect_ratio: str,
    voice: str | None,
) -> str:
    """Construct the per-request user message (one-shot path, no agent)."""
    voice_line = f"- voice cho từng scene: \"{voice}\"" if voice else "- voice: null"
    return f"""Hãy sinh storyboard từ nội dung sau.

Cấu hình:
- template: "{template}"
- aspect_ratio: "{aspect_ratio}"
{voice_line}

Nội dung:
\"\"\"
{text}
\"\"\"

Chỉ trả về JSON đúng schema, không thêm chữ nào khác."""


def build_storyboard_user_prompt_with_analysis(
    *,
    text: str,
    template: str,
    aspect_ratio: str,
    voice: str | None,
    analyzer_hints: dict,
) -> str:
    """Variant of ``build_user_prompt`` that prepends analyzer hints.

    `analyzer_hints` is expected to carry `primary_hook`, `main_number`, `theme`,
    `tone`, `key_facts`, `suggested_scene_count`, `language_register`,
    `content_summary`, `visual_style` (full ``AnalyzerResult.model_dump()``).
    Used by ``StoryboardAgent`` to anchor the writer on the analyzer's structural
    + thematic guidance.
    """
    voice_line = f"- voice cho từng scene: \"{voice}\"" if voice else "- voice: null"

    hook = analyzer_hints.get("primary_hook", "")
    main_number = analyzer_hints.get("main_number", "")
    theme = analyzer_hints.get("theme", "default")
    tone = analyzer_hints.get("tone", "")
    register = analyzer_hints.get("language_register", "")
    scenes_target = analyzer_hints.get("suggested_scene_count", "")
    summary = analyzer_hints.get("content_summary", "")
    visual_style = analyzer_hints.get("visual_style", "")
    facts = analyzer_hints.get("key_facts", []) or []
    facts_lines = "\n".join(f"  - {f}" for f in facts) or "  (không có)"

    main_number_line = (
        f"- **MAIN NUMBER (BẮT BUỘC xuất hiện ở scene 0 HOẶC 1)**: \"{main_number}\""
        if main_number else "- main_number: (không xác định — chọn hook khác)"
    )

    return f"""Hãy sinh storyboard từ nội dung sau, BÁM SÁT các gợi ý của analyzer.

Cấu hình kỹ thuật:
- template: "{template}"
- aspect_ratio: "{aspect_ratio}"
{voice_line}

Gợi ý từ analyzer (ưu tiên cao):
- Hook đề xuất (scene 0 phải dùng / biến thể gần): "{hook}"
{main_number_line}
- **Theme** (chi phối tone narration + emoji + accent words): "{theme}"
- Tone giọng: "{tone}"
- Văn phong: "{register}"
- Visual style hint (gợi ý loại scene type chính): "{visual_style}"
- Số scene đề xuất (PHẢI dùng đúng con số này): {scenes_target}
- Tóm tắt nội dung: "{summary}"
- Các fact KEY phải xuất hiện trong scenes (không bịa thêm fact ngoài source):
{facts_lines}

Nội dung gốc đầy đủ:
\"\"\"
{text}
\"\"\"

Chỉ trả về JSON đúng schema (theo SCENE TYPES của ngách "{template}"), không thêm chữ nào khác."""


# Re-export for back-compat (old import sites may still reference STORYBOARD_SYSTEM_PROMPT)
STORYBOARD_SYSTEM_PROMPT = _GENERIC_SYSTEM_PROMPT
