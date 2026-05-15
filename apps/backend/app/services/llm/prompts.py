"""System + user prompt builders for storyboard generation.

`build_system_prompt(template)` returns the per-niche SKILL.md body (if any) +
a shared scene-type vocabulary block. SKILL.md provides niche-specific style,
allowed scene types, and sequencing rules. The vocabulary block is the single
source of truth for valid scene `type` values (mirrored from
`packages/remotion-engine/src/components/scenes/types.ts`).
"""

from __future__ import annotations

from app.services.scene_types import scene_type_schema_block
from app.services.skills import load_skill

_GENERIC_STYLE_BRIEF = """\
PHONG CÁCH NGHỆ THUẬT (REMOTION KINETIC):
- Video ngắn (TikTok/Reels/Shorts) nhịp nhanh, chữ chạy sống động theo lời nói.
- Mỗi scene phải cô đọng, sắc bén, đánh thẳng tâm lý người xem.
- Visual_prompt mô tả chi tiết bằng tiếng Anh: bối cảnh + ánh sáng + camera + mood.
"""

_SCHEMA_BLOCK = """\
=== CẤU TRÚC JSON STORYBOARD (BẮT BUỘC) ===
{
  "title": "Tiêu đề gây tò mò",
  "template": "<template>",
  "theme": "danger | warning | default | success",
  "aspect_ratio": "9:16",
  "scenes": [
    {
      "id": 0,
      "type": "<scene type — chọn theo bảng dưới>",
      "duration_sec": 3.5,
      "visual_prompt": "Cinematic English description (camera + lighting + subject + mood, ≥10 từ)",
      "text": "Nội dung chữ hiển thị trên màn hình (ngắn gọn)",
      "caption": {
        "vi": "Lời thoại đầy đủ cho AI đọc (quan trọng nhất — sinh word_timings)"
      }
    }
  ],
  "total_duration_sec": 25.5
}
"""

_VARIETY_RULES = """\
=== QUY TẮC ĐA DẠNG SCENE (BẮT BUỘC) ===
1. **Mở đầu**: scene 0 = `hero` HOẶC `stat` (hook mạnh trong 2 giây đầu).
2. **Kết thúc**: scene cuối PHẢI là `cta` (lời kêu gọi hành động cụ thể).
3. **Đa dạng**: 1 video phải có ≥4 scene `type` khác nhau. CẤM toàn bộ là kinetic/hero.
4. **Không lặp liên tiếp**: không quá 1 scene cùng `type` đứng kề nhau.
5. **Ưu tiên scene có cấu trúc** (explainer/list/grid/timeline/comparison) thay vì
   kinetic/hero chỉ chạy chữ. Mỗi video ngắn cần ≥3 scene có items/bullets.
6. **Khi voice giải thích 2+ ý** → DÙNG `explainer` (title + bullets, voice diễn giải
   từng bullet). KHÔNG dồn nhiều ý vào 1 câu kinetic.
7. **Nhịp điệu**: scene `hero`/`stat`/`cta` 2.5-3.5s; `explainer`/`list`/`grid`/`timeline`
   4-7s (cần đủ thời gian để voice nói qua từng bullet).
8. **item_phrases bắt buộc** với mọi scene có items/bullets/cells/steps — engine cần
   biết voice đọc đến đâu thì bullet nào phải active.
"""

_GOLDEN_RULES = """\
=== NGUYÊN TẮC VÀNG ===
1. **Hook thần thánh (Scene 0)**: câu hỏi gây sốc / con số ấn tượng / nghịch lý trong 2 giây đầu.
2. **Visual prompt BẮT BUỘC tiếng Anh, ≥10 từ**: KHÔNG dùng từ chung chung
   ("computer", "money"). PHẢI có camera angle, lighting, mood.
3. **Logic**: chuyển cảnh mượt, mỗi scene kế thừa/phát triển từ scene trước.
4. **Không bịa số / nhân vật**: chỉ dùng fact có trong nội dung gốc.
"""


def build_system_prompt(template: str) -> str:
    """Storyboard system prompt — wraps SKILL.md (if any) with shared rules."""
    skill = load_skill(template)
    niche_brief = skill.system_prompt if skill else _GENERIC_STYLE_BRIEF
    schema = _SCHEMA_BLOCK.replace("<template>", template)
    return f"""\
BẠN LÀ CREATIVE DIRECTOR cho video ngắn (TikTok/Reels/Shorts) ngách "{template}".
Nhiệm vụ: chuyển nội dung thô thành storyboard JSON có tính lan truyền cao,
đa dạng visual, bám sát voice.

{niche_brief}

{schema}

{scene_type_schema_block()}

{_VARIETY_RULES}

{_GOLDEN_RULES}
"""


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

Chỉ trả về JSON đúng cấu trúc, không thêm chữ nào khác. Đảm bảo đa dạng scene type và đóng bằng `cta`."""


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
    `content_summary`, `visual_style`, and optionally `scene_type_mix`
    (full ``AnalyzerResult.model_dump()``). Used by ``StoryboardAgent`` to anchor
    the writer on the analyzer's structural + thematic guidance.
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
    scene_type_mix = analyzer_hints.get("scene_type_mix") or {}
    facts = analyzer_hints.get("key_facts", []) or []
    facts_lines = "\n".join(f"  - {f}" for f in facts) or "  (không có)"

    main_number_line = (
        f"- **MAIN NUMBER (BẮT BUỘC xuất hiện ở scene 0 HOẶC 1)**: \"{main_number}\""
        if main_number else "- main_number: (không xác định — chọn hook khác)"
    )

    if scene_type_mix:
        mix_lines = ", ".join(f"{k}×{v}" for k, v in scene_type_mix.items())
        mix_block = f"- **Scene type mix đề xuất** (ưu tiên cao — tạo đa dạng visual): {mix_lines}"
    else:
        mix_block = "- Scene type mix: (tự do, nhưng phải ≥3 type khác nhau)"

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
- Visual style hint: "{visual_style}"
{mix_block}
- Các fact KEY phải xuất hiện trong scenes:
{facts_lines}
- Số lượng scene đề xuất (tham khảo): {scenes_target}
- Content summary: "{summary}"

Nội dung gốc đầy đủ:
\"\"\"
{text}
\"\"\"

Chỉ trả về JSON đúng schema, không thêm chữ nào khác. ƯU TIÊN đa dạng scene type, scene cuối là `cta`."""


# Re-export for back-compat (old import sites may still reference STORYBOARD_SYSTEM_PROMPT)
STORYBOARD_SYSTEM_PROMPT = "Bạn là biên kịch video ngắn chuyên nghiệp."
