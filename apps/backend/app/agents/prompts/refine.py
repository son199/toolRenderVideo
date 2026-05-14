"""Prompts for refine pass — draft + critique → revised storyboard."""

from __future__ import annotations


def build_refine_user_prompt(
    *,
    draft_storyboard_json: str,
    review_feedback_json: str,
    raw_text: str,
) -> str:
    """User prompt for the refine call.

    System prompt re-uses the per-niche storyboard SKILL.md prompt (via
    ``services/llm/prompts.build_system_prompt``), so the model still operates
    under the same JSON schema requirement and tone constraints — refine just
    feeds it the existing draft plus the reviewer's feedback to fix.
    """
    return f"""Đây là storyboard draft trước đó:

```json
{draft_storyboard_json}
```

Reviewer đã chỉ ra các vấn đề sau:

```json
{review_feedback_json}
```

Nội dung gốc (để bám):
\"\"\"
{raw_text}
\"\"\"

Hãy sửa storyboard theo từng `suggested_fix` của reviewer. Yêu cầu:

1. **Giữ những scene đã ổn**, chỉ sửa những chỗ reviewer flag.

2. **GIỮ NGUYÊN `type` field + tất cả type-specific fields của mỗi scene** —
   KHÔNG được regress về flat schema. Các field bắt buộc per type:
   - `hero-text` / `question-hero` → giữ `emoji`, `headline`/`question`, `sub`, `accent`
   - `stats-grid` → giữ `stats[]` với mỗi item có `big` + `label` (+ optional `accent`)
   - `terminal` → giữ `title` + `lines[]` với mỗi item có `type` + `text`
   - `code-diff` → giữ `badLabel`, `bad`, `goodLabel`, `good`
   - `quote` / `quote-card` → giữ `text` + `attr`
   - `cta-url` → giữ `label`, `url`, `sub`
   - `product-card` → giữ `name`, `tagline`, `badge`, `subtext`
   - `feature-grid` → giữ `features[]` với mỗi item có `icon`, `title`, `desc`
   - `line-statement` → giữ `line`, `emphasis`
   - `closing-card` → giữ `line`, `footer`

3. **Mọi scene đều phải có `caption.vi` + `caption.en`** — KHÔNG bỏ.

4. **Bám nội dung gốc** — KHÔNG bịa số / nhân vật mới ngoài source.

5. **Đảm bảo schema hợp lệ**:
   - `scenes[].id` liên tiếp từ 0
   - `total_duration_sec` = sum của tất cả `duration_sec`
   - Type của mỗi scene PHẢI thuộc danh sách hợp lệ của ngách (xem SKILL.md)

6. **Nếu reviewer flag B1 (main_number placement)**: DỜI scene chứa main_number
   lên vị trí 0 hoặc 1 — KHÔNG xoá hoặc tạo scene mới. Re-number `id` cho liên tiếp.

7. **Nếu reviewer flag A5 (sai type)**: chuyển scene về đúng type của ngách +
   bổ sung type-specific fields tương ứng — KHÔNG để scene type sai sót lại.

Trả về JSON storyboard hoàn chỉnh đã sửa. Không thêm chữ giải thích nào khác."""
