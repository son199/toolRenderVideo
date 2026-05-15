"""Python mirror of `packages/remotion-engine/src/components/scenes/types.ts`.

Single source of truth for the LLM prompt schema and reviewer rubric. Must stay
in sync with the TS file by hand — both lists are short and rarely change.
"""

from __future__ import annotations

from typing import Literal, get_args

SceneType = Literal[
    "hero",
    "stat",
    "quote",
    "comparison",
    "list",
    "product",
    "cta",
    "terminal",
    "timeline",
    "grid",
    "explainer",
    "kinetic",
]

SCENE_TYPES: tuple[str, ...] = get_args(SceneType)

# Short descriptions for the LLM — keep terse, the LLM doesn't need style details.
SCENE_TYPE_DESCRIPTIONS: dict[str, str] = {
    "hero": "Tiêu đề lớn ở trung tâm, dramatic, dùng cho hook/intro hoặc câu chốt mạnh.",
    "stat": "Con số khổng lồ làm trung tâm, label phía dưới — CHỈ DÙNG khi có 1 con số sạch (vd 60+, 20%, 1.5K). KHÔNG dùng cho câu thường.",
    "quote": "Trích dẫn italic, attribution nhỏ — dùng cho lời chuyên gia / khẳng định.",
    "comparison": "Split-screen 2 cột — CHỈ DÙNG khi có 2 khái niệm tương phản rõ. PHẢI cung cấp `left` và `right` riêng (vd left='Cách cũ', right='Cách mới').",
    "list": "Bullet point stagger animation theo chiều dọc — dùng cho 'top N', danh sách. Cung cấp `items: string[]`.",
    "product": "Ảnh + text + CTA — dùng cho giới thiệu sản phẩm/giải pháp/feature. Cung cấp `name` + `tagline`.",
    "cta": "Call-to-action full-bleed, end card — DÙNG CHO SCENE CUỐI. Cung cấp `label` (CTA chính, ngắn gọn ≤ 6 từ) + `sub` + `url`.",
    "terminal": "Mock CLI typing animation — dùng cho command/code (npm install, curl, git…). Cung cấp `command: string` hoặc `lines: [{prompt,text}]`.",
    "timeline": "Vertical numbered timeline với dots — dùng cho quy trình từng bước. Cung cấp `steps: [{label, detail?}]`.",
    "grid": "Lưới 2×2/2×3/3×3 cards — dùng để show nhiều tính năng cùng lúc. Cung cấp `cells: [{label, icon?}]` (4–9 items). Khi voice nhắc tới cell nào → cell đó tự highlight. Cung cấp `item_phrases: string[]` (cùng độ dài cells) để khớp chính xác hơn.",
    "explainer": "★ KEY SCENE TYPE cho video pro-viral. Title to ở trên + 3-5 bullet cards bên dưới, mỗi bullet active đồng bộ voice. Cung cấp `title` + `bullets: [{label, icon?}]` + `item_phrases: string[]` (1 phrase/bullet). Voice KHÔNG cần đọc nguyên bullet — voice diễn giải, bullet là điểm chính. ƯU TIÊN dùng type này thay vì hero/kinetic khi có 2+ ý cần nêu.",
    "kinetic": "Chữ chạy word-by-word kèm voice — CHỈ DÙNG khi không có cấu trúc bullets/items. Hạn chế dùng, ưu tiên explainer/list/grid.",
}

# Hint cho LLM về `item_phrases` field (đồng bộ scene & voice)
ITEM_PHRASES_GUIDE = """
QUAN TRỌNG — đồng bộ voice với bullets/items/cells:
- Với mọi scene type list/grid/timeline/explainer, BẮT BUỘC cung cấp `item_phrases`:
  một mảng cùng độ dài với items/bullets/cells, mỗi phần tử là cụm từ tiếng Việt
  ĐẦU TIÊN trong `caption.vi` mà voice sẽ phát ra để bắt đầu giải thích item đó.
- Ví dụ: bullets=["Ra đời 2016","Trụ sở Mỹ","Giá 20.000 USD"], caption.vi="Groq được
  thành lập năm 2016 tại Mỹ, mỗi chip giá 20 nghìn đô.", → item_phrases=["thành lập","tại Mỹ","mỗi chip"].
- Phải khớp 100% tiếng/chữ với caption.vi để engine match được. Không có dấu phẩy/chấm.
- Caption.vi phải chứa đủ N cụm theo đúng thứ tự items.
""".strip()


def scene_type_schema_block() -> str:
    """Return a markdown block describing all scene types for the LLM prompt."""
    lines = [
        "Các scene type hợp lệ (ƯU TIÊN explainer/list/grid/timeline — KHÔNG được",
        "lạm dụng hero/kinetic vì nhàm và đơn điệu):",
    ]
    for t in SCENE_TYPES:
        lines.append(f'  - "{t}": {SCENE_TYPE_DESCRIPTIONS[t]}')
    lines.append("")
    lines.append(ITEM_PHRASES_GUIDE)
    return "\n".join(lines)
