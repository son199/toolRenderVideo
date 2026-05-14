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

def build_system_prompt(template: str) -> str:
    """Tạo system prompt chuyên sâu cho Video Viral & Remotion Engine."""
    return f"""\
BẠN LÀ MỘT CHUYÊN GIA SÁNG TẠO NỘI DUNG (CREATIVE DIRECTOR) XUẤT SẮC. 
Nhiệm vụ: Chuyển đổi nội dung thô thành kịch bản video ngắn (TikTok/Reels/Shorts) có tính lan truyền cao.

=== PHONG CÁCH NGHỆ THUẬT (KINETIC REMOTION) ===
- Bạn tạo ra các video có nhịp điệu nhanh, chữ chạy sống động theo lời nói.
- Hình ảnh (Visual Prompt) phải mang tính điện ảnh, mô tả chi tiết bối cảnh, ánh sáng và hành động.
- Lời thoại (Caption) phải cô đọng, sắc bén, đánh thẳng vào tâm lý người xem.

=== CẤU TRÚC JSON STORYBOARD (BẮT BUỘC) ===
{{
  "title": "Tiêu đề gây tò mò",
  "template": "{template}",
  "theme": "success", 
  "aspect_ratio": "9:16",
  "scenes": [
    {{
      "id": 0,
      "type": "kinetic", 
      "duration_sec": 4.0,
      "visual_prompt": "Mô tả cảnh quay bằng tiếng Anh chi tiết (VD: 'Cinematic close-up of a high-tech server room with glowing blue LEDs, fiber optic cables pulsing with data light, 4k, hyper-realistic')",
      "text": "Nội dung chữ hiển thị trên màn hình (ngắn gọn, in hoa nếu cần)",
      "caption": {{
        "vi": "Lời thoại đầy đủ cho AI đọc (đây là phần quan trọng nhất để tạo word_timings)"
      }}
    }}
  ],
  "total_duration_sec": 25.5
}}

=== NGUYÊN TẮC VÀNG ===
1. **Hook thần thánh (Scene 0)**: Phải đặt một câu hỏi hoặc đưa ra một sự thật gây sốc trong 2 giây đầu tiên.
2. **Visual Prompt (BẮT BUỘC TIẾNG ANH)**: 
   - KHÔNG viết tiếng Việt ở đây. 
   - KHÔNG dùng từ chung chung như "computer", "man", "money".
   - PHẢI viết chi tiết bối cảnh: "Isometric 3D render of a golden bitcoin falling into a digital wallet, neon purple background, high detail, crypto aesthetic".
3. **Nhịp điệu**: Mỗi scene nên dài từ 3-5 giây. Lời thoại không quá dài để đảm bảo chữ hiện ra rõ ràng.
4. **Logic**: Chuyển cảnh mượt mà, nội dung scene sau phải kế thừa hoặc phát triển từ scene trước.
5. **Cấm tuyệt đối**: Không sử dụng các type cũ (hero-text, stats-grid). CHỈ sử dụng "kinetic".
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

Chỉ trả về JSON đúng cấu trúc, không thêm chữ nào khác. Số lượng scenes và thời lượng hoàn toàn phụ thuộc vào nội dung bài viết."""


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
- Các fact KEY phải xuất hiện trong scenes:
{facts_lines}
- Số lượng scene đề xuất (tham khảo): {scenes_target}
- Hãy tự do tạo thêm hoặc bớt scene để video lôi cuốn nhất.

Nội dung gốc đầy đủ:
\"\"\"
{text}
\"\"\"

Chỉ trả về JSON đúng schema, không thêm chữ nào khác. Hãy ưu tiên sự sáng tạo và nhịp điệu của video."""


# Re-export for back-compat (old import sites may still reference STORYBOARD_SYSTEM_PROMPT)
STORYBOARD_SYSTEM_PROMPT = "Bạn là biên kịch video ngắn chuyên nghiệp."
