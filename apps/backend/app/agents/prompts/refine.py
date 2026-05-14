"""Prompts for refine pass — draft + critique → revised storyboard."""

from __future__ import annotations


def build_refine_user_prompt(
    *,
    draft_storyboard_json: str,
    review_feedback_json: str,
    raw_text: str,
) -> str:
    """User prompt for the refine call, optimized for Remotion dynamic logic."""
    return f"""Đây là storyboard draft trước đó:

```json
{draft_storyboard_json}
```

Reviewer đã chỉ ra các vấn đề sau:

```json
{review_feedback_json}
```

Nội dung gốc (để đối chiếu):
\"\"\"
{raw_text}
\"\"\"

Nhiệm vụ: Hãy tinh chỉnh lại storyboard dựa trên các góp ý của reviewer để video trở nên hoàn hảo hơn.

=== QUY TẮC TINH CHỈNH ===
1. **Sử dụng duy nhất type: "kinetic"**: Loại bỏ hoàn toàn các loại scene cũ (hero-text, stats-grid,...) nếu còn sót lại.
2. **Cấu trúc linh hoạt**: Bạn có thể thay đổi số lượng scenes, thời lượng từng scene để đảm bảo video có nhịp điệu tốt nhất.
3. **Nội dung caption**: Đảm bảo lời thoại tiếng Việt (`caption.vi`) tự nhiên, lôi cuốn và bám sát các sự kiện quan trọng trong bài viết.
4. **Hình ảnh nền**: Cải thiện `visual_prompt` (tiếng Anh) để engine có thể lấy được các đoạn video B-roll chất lượng nhất từ kho Stock.
5. **Đảm bảo JSON hợp lệ**:
   - `scenes[].id` liên tiếp từ 0.
   - `total_duration_sec` = tổng thời lượng của các scenes.

Chỉ trả về JSON storyboard hoàn chỉnh đã sửa. Không thêm chữ giải thích nào khác."""
