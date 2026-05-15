"""B-roll picker — choose a stock video URL from a category pool based on the
scene's `visual_prompt` and `type`, with per-job dedupe so the same URL doesn't
repeat across scenes in one project.

Previous version had 6 URLs total and a 3-branch keyword match, so a 10-scene
video would reuse the same clip 3-4 times. This expands the pool, adds richer
keyword coverage (Vietnamese + English), and round-robins within a category to
avoid duplicates as long as the category has enough entries.
"""

from __future__ import annotations

import random
from collections import defaultdict
from threading import Lock

MIXKIT = "https://assets.mixkit.co/videos/preview"

# Categorized pool — each list is fetched in order, then random-shuffled to spread
# selection across scenes that share a category.
POOL: dict[str, list[str]] = {
    "tech": [
        f"{MIXKIT}/mixkit-server-room-with-rows-of-computer-servers-and-blinking-lights-15822-large.mp4",
        f"{MIXKIT}/mixkit-software-developer-working-on-a-computer-at-night-17631-large.mp4",
        f"{MIXKIT}/mixkit-abstract-technology-connection-with-nodes-and-lines-27488-large.mp4",
        f"{MIXKIT}/mixkit-spinning-particles-in-the-shape-of-a-sphere-46903-large.mp4",
        f"{MIXKIT}/mixkit-digital-animation-of-futuristic-devices-99-large.mp4",
        f"{MIXKIT}/mixkit-binary-code-data-flow-on-a-computer-screen-44621-large.mp4",
    ],
    "code": [
        f"{MIXKIT}/mixkit-software-developer-working-on-a-computer-at-night-17631-large.mp4",
        f"{MIXKIT}/mixkit-programmer-writing-code-on-a-computer-44606-large.mp4",
        f"{MIXKIT}/mixkit-close-up-of-a-programmer-coding-on-his-laptop-44619-large.mp4",
        f"{MIXKIT}/mixkit-binary-code-data-flow-on-a-computer-screen-44621-large.mp4",
    ],
    "money": [
        f"{MIXKIT}/mixkit-falling-crypto-coins-39908-large.mp4",
        f"{MIXKIT}/mixkit-stock-market-going-up-and-down-1234-large.mp4",
        f"{MIXKIT}/mixkit-coins-stacked-up-on-a-table-1232-large.mp4",
    ],
    "abstract": [
        f"{MIXKIT}/mixkit-abstract-technology-connection-with-nodes-and-lines-27488-large.mp4",
        f"{MIXKIT}/mixkit-spinning-particles-in-the-shape-of-a-sphere-46903-large.mp4",
        f"{MIXKIT}/mixkit-neon-lights-in-the-shape-of-a-tunnel-34208-large.mp4",
        f"{MIXKIT}/mixkit-blue-particles-flowing-through-space-32443-large.mp4",
        f"{MIXKIT}/mixkit-colored-smoke-on-a-black-background-2425-large.mp4",
        f"{MIXKIT}/mixkit-purple-light-effect-with-particles-39888-large.mp4",
    ],
    "cinematic": [
        f"{MIXKIT}/mixkit-camera-flying-through-clouds-during-sunset-1611-large.mp4",
        f"{MIXKIT}/mixkit-mountain-peak-at-sunrise-29354-large.mp4",
        f"{MIXKIT}/mixkit-fire-burning-in-the-darkness-39911-large.mp4",
    ],
    "office": [
        f"{MIXKIT}/mixkit-business-team-having-a-meeting-in-the-office-4641-large.mp4",
        f"{MIXKIT}/mixkit-young-businessman-working-on-his-laptop-23-large.mp4",
    ],
}

KEYWORD_TO_CATEGORY: list[tuple[tuple[str, ...], str]] = [
    (("terminal", "command", "cli", "npm", "install", "curl", "bash", "code", "coding", "lập trình", "lệnh"), "code"),
    (("server", "data center", "máy chủ", "hosting"), "tech"),
    (("crypto", "coin", "bitcoin", "tài chính", "money", "finance", "stock", "tiền"), "money"),
    (("particle", "abstract", "neon", "digital", "ai", "trí tuệ", "công nghệ", "technology"), "abstract"),
    (("cloud", "sky", "sunset", "mountain", "thiên nhiên", "trời", "núi"), "cinematic"),
    (("office", "business", "team", "meeting", "doanh nghiệp", "công ty"), "office"),
]

# Per-job rotation state — keyed by job/project id; cleared when caller passes
# a new id. Round-robin within a category so consecutive scenes don't repeat.
_rotation: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
_used: dict[str, set[str]] = defaultdict(set)
_lock = Lock()


def reset_rotation(job_id: str) -> None:
    """Drop rotation state for `job_id`. Call this at the start of a new project."""
    with _lock:
        _rotation.pop(job_id, None)
        _used.pop(job_id, None)


def pick_broll(visual_prompt: str, scene_type: str, scene_idx: int, job_id: str = "default") -> str:
    """Pick a b-roll URL for a scene.

    `scene_idx` is used as a tiebreaker so multiple parallel scenes don't all
    grab the head of the rotation. Within a job, the same URL is avoided until
    the pool is exhausted.
    """
    category = _resolve_category(visual_prompt, scene_type)
    pool = POOL.get(category) or POOL["abstract"]

    with _lock:
        used = _used[job_id]
        # Prefer unused URLs in this job
        unused = [u for u in pool if u not in used]
        if unused:
            idx = (_rotation[job_id][category] + scene_idx) % len(unused)
            url = unused[idx]
        else:
            # Pool exhausted — pick random (acceptable for very long videos)
            url = random.choice(pool)
        _rotation[job_id][category] += 1
        used.add(url)
        return url


def _resolve_category(visual_prompt: str, scene_type: str) -> str:
    if scene_type == "terminal":
        return "code"
    if scene_type == "grid":
        return "abstract"
    if scene_type == "timeline":
        return "abstract"
    prompt = (visual_prompt or "").lower()
    for keywords, category in KEYWORD_TO_CATEGORY:
        if any(k in prompt for k in keywords):
            return category
    return "abstract"
