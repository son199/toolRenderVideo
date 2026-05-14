"""Full-pipeline runner that wires ingest → storyboard → tts → render and emits progress.

Phase 1: in-process asyncio.Task per job — no Celery, no Redis. Swap with a Celery
task in Phase 2 by replacing ``enqueue_full_pipeline`` and keeping the
``ProgressEvent`` shape on the wire.

Idempotent: re-running on a project that's already past a stage skips that stage.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from app import repository
from app.config import get_settings
from app.events import ProgressEvent, get_bus
from app.services.ingest import IngestError, ingest
from app.services.llm import get_provider as get_llm_provider
from app.services.llm.base import LLMError
from app.services.render import RenderError, assemble_final_video, record_template
from app.services.render.ffmpeg_post import FFmpegError
from app.services.scene_text import narration_text
from app.services.subtitle import timings_to_dict, write_srt
from app.services.tts import get_provider as get_tts_provider
from app.services.tts.base import TTSError

logger = logging.getLogger(__name__)


def enqueue_full_pipeline(project_id: uuid.UUID) -> str:
    """Kick off the full pipeline in the background. Returns a job id."""
    job_id = uuid.uuid4().hex
    task = asyncio.create_task(_run_full_pipeline(project_id, job_id))
    task.add_done_callback(_log_task_completion)
    return job_id


async def _run_full_pipeline(project_id: uuid.UUID, job_id: str) -> None:
    bus = get_bus()
    pid = str(project_id)
    settings = get_settings()

    async def emit(stage: str, progress: float, message: str = "", payload: dict | None = None) -> None:
        await bus.emit(
            ProgressEvent(
                project_id=pid, stage=stage, progress=progress, message=message, payload=payload
            )
        )

    async def fail(stage_message: str) -> None:
        repository.update_project(project_id, {"status": "failed", "error": stage_message})
        await emit("error", 1.0, stage_message)

    try:
        await emit("queued", 0.0, f"Job {job_id} queued")
        project = repository.get_project(project_id)
        if project is None:
            await fail("Project not found")
            return

        # ----- 1. Ingest -----
        if not project.raw_text:
            await emit("ingest", 0.05, "Đang ingest input...")
            try:
                raw = await asyncio.to_thread(ingest, project)
            except IngestError as exc:
                await fail(f"Ingest failed: {exc}")
                return
            repository.update_project(
                project_id, {"raw_text": raw, "status": "ingested", "error": None}
            )

        # ----- 2. Storyboard -----
        project = repository.get_project(project_id) or project
        if not project.storyboard:
            provider = get_llm_provider()
            try:
                if project.use_agent:
                    from app.agents import AgentError, VideoCreatorAgent

                    await emit("storyboard", 0.10, "AI Agent: phân tích → draft → review...")
                    agent = VideoCreatorAgent(provider, progress=emit)
                    try:
                        storyboard = await agent.generate(
                            raw_text=project.raw_text or "",
                            template=project.template,
                            aspect_ratio=project.aspect_ratio,
                            voice=project.voice,
                        )
                    except AgentError as exc:
                        await fail(f"Agent failed at {exc.stage}: {exc.detail}")
                        return
                else:
                    await emit("storyboard", 0.15, "Sinh storyboard từ LLM (one-shot)...")
                    storyboard = await asyncio.to_thread(
                        provider.generate_storyboard,
                        project.raw_text or "",
                        template=project.template,
                        aspect_ratio=project.aspect_ratio,
                        voice=project.voice,
                    )
            except LLMError as exc:
                await fail(f"LLM failed: {exc}")
                return


            # Patch: Đảm bảo mọi scene đều có trường text (dùng narration_text),
            # tự động sửa lỗi dính chữ, và sinh tts_beats cho feature-grid.
            from app.services.scene_text import narration_text
            import re
            sb_obj = getattr(storyboard, "storyboard", storyboard)
            if hasattr(sb_obj, "model_dump"):
                sb_dict = sb_obj.model_dump(mode="json")
            elif hasattr(sb_obj, "dict"):
                sb_dict = sb_obj.dict()
            else:
                sb_dict = dict(sb_obj)

            def fix_spacing(text: str) -> str:
                # Thêm khoảng trắng giữa số và chữ, giữa các từ dính liền, loại bỏ double space
                if not isinstance(text, str):
                    return text
                # Tách số và chữ dính liền: "20–65%tokenAI" -> "20–65% token AI"
                text = re.sub(r"(\d)([A-Za-zÀ-ỹ])", r"\1 \2", text)
                text = re.sub(r"([a-zA-ZÀ-ỹ])([0-9])", r"\1 \2", text)
                # Tách chữ hoa dính liền: "tokenAI" -> "token AI"
                text = re.sub(r"([a-zà-ỹ])([A-Z])", r"\1 \2", text)
                # Tách các từ tiếng Việt dính liền không có chữ hoa (ví dụ: quotaAI, chưađùnghết)
                # Sử dụng từ điển các từ phổ biến để tách, mở rộng thêm các từ công nghệ, brand, model
                VIET_WORDS = [
                    "bạn", "vẫn", "mất", "tiền", "cho", "quota", "ai", "chưa", "dùng", "hết", "kết", "nối", "nền", "tảng", "dư", "thừa", "hơn", "slot", "provider", "tận", "dụng", "mọi", "đã", "với", "còn", "của", "vì", "khi", "được", "trong", "giá", "rẻ", "mỗi", "tháng", "token", "phần", "mềm", "bản", "quyền", "doanh", "nghiệp", "sim", "bị", "khóa", "thiết", "bị", "công", "nghệ", "mới", "xperia", "sony", "oppo", "find", "ios", "tech", "news", "ra", "mắt", "liên", "tục", "đổi", "mới", "nhiều", "cải", "tiến", "hiệu", "suất", "kiểu", "dáng", "khác", "biệt", "xác", "thực", "bảo", "vệ", "thuê", "bao"
                ]
                # Tách các từ dính liền bằng cách chèn space trước các từ phổ biến nếu phía trước là chữ thường hoặc số
                for w in VIET_WORDS:
                    text = re.sub(rf"([a-z0-9À-ỹ])({w})", r"\1 \2", text, flags=re.IGNORECASE)
                # Tách các brand/model viết liền: iOS, TechNews, SIM, Xperia, FindX9s, OPPO, Sony
                text = re.sub(r"(i)(OS)", r"\1 \2", text)
                text = re.sub(r"(Tech)(News)", r"\1 \2", text)
                text = re.sub(r"(SIM)(bị|khóa|mới|thiết|xác|bảo|vệ|thuê|bao)", r"\1 \2", text, flags=re.IGNORECASE)
                text = re.sub(r"(Xperia|OPPO|Sony|Find)([A-Z])", r"\1 \2", text)
                # Loại bỏ double space
                text = re.sub(r"\s+", " ", text)
                return text.strip()



            scenes = sb_dict.get("scenes")
            if isinstance(scenes, list):
                for scene in scenes:
                    # Sửa spacing cho các trường text/caption/headline/sub...
                    for key in ("text", "headline", "sub"):
                        if key in scene and isinstance(scene[key], str):
                            scene[key] = fix_spacing(scene[key])
                    if "caption" in scene and isinstance(scene["caption"], dict):
                        for capk in ("vi", "en"):
                            if capk in scene["caption"] and isinstance(scene["caption"][capk], str):
                                scene["caption"][capk] = fix_spacing(scene["caption"][capk])
                    # Đảm bảo luôn có text
                    text_val = scene.get("text")
                    narr = narration_text(scene)
                    if not isinstance(text_val, str) or not text_val.strip():
                        scene["text"] = narr

                    # Nếu thiếu animation_phases, tự động sinh mặc định
                    if "animation_phases" not in scene or not isinstance(scene["animation_phases"], dict):
                        scene_type = scene.get("type")
                        if scene_type == "hero-text":
                            scene["animation_phases"] = {
                                "intro": {"emoji": "bounce-in 0.3s spring", "headline_words": "stagger-up 0.08s/word ease-out"},
                                "hold": {"emoji": "float y:-6px 1.8s repeat:-1 yoyo:true", "bg_gradient": "shift-hue 4s repeat:-1 yoyo:true"},
                                "outro": {"all": "blur-out + scale 1→0.95 0.3s ease-in"}
                            }
                        elif scene_type == "product-card":
                            scene["animation_phases"] = {
                                "intro": {"logo": "pop-in 0.3s", "badge": "fade-in 0.2s"},
                                "hold": {"logo": "float y:-6px 2s repeat:-1 yoyo:true", "badge": "pulse-glow 2s repeat:-1 yoyo:true"},
                                "outro": {"all": "fade-out scale:1→1.02 0.3s"}
                            }
                        elif scene_type == "feature-grid":
                            scene["animation_phases"] = {
                                "intro": {"items": "stagger-pop-in 0.12s/item spring delay:0.2s"},
                                "hold": {"card_float": "subtle-float y:-4px 2.5s repeat:-1 yoyo:true", "border_glow": "border-glow pulse 1.6s repeat:-1 yoyo:true"},
                                "outro": {"all": "stagger-fade-down 0.08s/item"}
                            }
                        elif scene_type == "cta-url":
                            scene["animation_phases"] = {
                                "intro": {"label": "bounce-in 0.4s spring", "url_box": "fade-slide-up 0.3s delay:0.3s"},
                                "hold": {"label": "text-glow pulse amber 2s repeat:-1 yoyo:true", "urgency_badge": "scale 1.0↔1.06 1.5s repeat:-1 yoyo:true", "bg": "vignette-pulse opacity:0.3↔0.5 2.5s repeat:-1 yoyo:true"},
                                "outro": {"all": "fade-out scale:1→1.02 0.3s"}
                            }
                        else:
                            scene["animation_phases"] = {
                                "intro": {},
                                "hold": {"bg": "float y:-3px 2.5s repeat:-1 yoyo:true"},
                                "outro": {"all": "fade-out 0.3s"}
                            }

                    # Tự động bổ sung hiệu ứng động vào hold phase nếu thiếu
                    anim = scene.get("animation_phases")
                    if isinstance(anim, dict):
                        hold = anim.get("hold")
                        if not isinstance(hold, dict):
                            hold = {}
                        n_effect = sum(
                            1 for v in hold.values() if isinstance(v, str) and ("repeat" in v or "yoyo" in v)
                        )
                        scene_type = scene.get("type")
                        if n_effect < 1:
                            if scene_type == "hero-text":
                                hold["emoji"] = "float y:-6px 1.8s repeat:-1 yoyo:true"
                                hold["bg_gradient"] = "shift-hue 4s repeat:-1 yoyo:true"
                            elif scene_type == "feature-grid":
                                hold["card_float"] = "subtle-float y:-4px 2.5s repeat:-1 yoyo:true"
                                hold["border_glow"] = "border-glow pulse 1.6s repeat:-1 yoyo:true"
                            elif scene_type == "product-card":
                                hold["logo"] = "float y:-6px 2s repeat:-1 yoyo:true"
                                hold["badge"] = "pulse-glow 2s repeat:-1 yoyo:true"
                            elif scene_type == "quote":
                                hold["text"] = "breathe scale:1.0↔1.005 3s repeat:-1 yoyo:true"
                                hold["highlight_words"] = "pulse amber 2.5s repeat:-1 yoyo:true"
                            elif scene_type == "cta-url":
                                hold["label"] = "text-glow pulse amber 2s repeat:-1 yoyo:true"
                                hold["urgency_badge"] = "scale 1.0↔1.06 1.5s repeat:-1 yoyo:true"
                                hold["bg"] = "vignette-pulse opacity:0.3↔0.5 2.5s repeat:-1 yoyo:true"
                            else:
                                hold["bg"] = "float y:-3px 2.5s repeat:-1 yoyo:true"
                        anim["hold"] = hold
                        scene["animation_phases"] = anim

                # Tự động sinh tts_beats cho feature-grid (focus từng item)
                for scene in scenes:
                    if scene.get("type") == "feature-grid" and "features" in scene:
                        features = scene["features"]
                        if isinstance(features, list):
                            beats = []
                            word_idx = 0
                            for i, feat in enumerate(features):
                                desc = feat.get("desc") or feat.get("title") or ""
                                n_words = len(desc.split()) if desc else 5
                                beats.append({"at_word": word_idx, "action": "focus_item", "item": i})
                                word_idx += n_words
                            beats.append({"at_word": word_idx, "action": "hold_start"})
                            beats.append({"at_word": -1, "action": "outro_start"})
                            scene["tts_beats"] = beats

            repository.update_project(
                project_id,
                {
                    "storyboard": sb_dict,
                    "status": "storyboard_ready",
                    "error": None,
                },
            )

        # ----- 3. TTS -----
        project = repository.get_project(project_id) or project
        scenes_have_audio = bool(project.scenes) and all(
            s.get("audio_path") for s in (project.scenes or [])
        )
        if not scenes_have_audio:
            tts = get_tts_provider()
            audio_dir = settings.storage_audio / pid
            audio_dir.mkdir(parents=True, exist_ok=True)
            # Fix: Đảm bảo scenes_input luôn là list, tránh lỗi NoneType khi lặp
            scenes_input = []
            if project.storyboard and isinstance(project.storyboard, dict):
                scenes_input = project.storyboard.get("scenes") or []
                if not isinstance(scenes_input, list):
                    scenes_input = []
            total = max(len(scenes_input), 1)
            updated_scenes: list[dict] = []

            try:
                for i, scene in enumerate(scenes_input):
                    scene_id = int(scene["id"])
                    voice = (
                        scene.get("voice") or project.voice or settings.tts_default_voice
                    )
                    out_path = audio_dir / f"scene_{scene_id:02d}.mp3"
                    await emit(
                        "tts",
                        0.30 + 0.30 * i / total,
                        f"Scene {i + 1}/{total}: sinh audio...",
                    )
                    text = narration_text(scene)
                    result = await tts.synthesize(
                        text=text, voice=voice, out_path=out_path
                    )
                    timings = result.word_timings
                    updated_scenes.append(
                        {
                            **scene,
                            "audio_path": str(result.audio_path),
                            "duration_sec": result.duration_sec,
                            "word_timings": (
                                timings_to_dict(timings) if timings else None
                            ),
                        }
                    )
            except TTSError as exc:
                await fail(f"TTS failed: {exc}")
                return

            srt_path = write_srt(updated_scenes, audio_dir / "subtitle.srt")
            repository.update_project(
                project_id,
                {
                    "scenes": updated_scenes,
                    "subtitle_path": str(srt_path),
                    "status": "tts_ready",
                    "error": None,
                },
            )

        # ----- 4. Render -----
        project = repository.get_project(project_id) or project
        repository.update_project(project_id, {"status": "rendering"})
        await emit("render", 0.65, "Mở Playwright và record template...")

        frames_dir = settings.storage_frames / pid
        output_path = settings.storage_output / f"{project_id}.mp4"
        audio_meta = [
            {
                "scene_id": s["id"],
                "duration_sec": s["duration_sec"],
                "word_timings": s.get("word_timings"),
            }
            for s in (project.scenes or [])
        ]

        try:
            result = await record_template(
                template=project.template,
                storyboard=project.storyboard or {},
                audio_meta=audio_meta,
                aspect_ratio=project.aspect_ratio,
                out_dir=frames_dir,
            )
        except RenderError as exc:
            await fail(f"Render (Playwright) failed: {exc}")
            return

        await emit("render", 0.88, "FFmpeg mux audio + burn subtitle...")
        try:
            audio_files = [Path(s["audio_path"]) for s in (project.scenes or [])]
            srt_path = Path(project.subtitle_path) if project.subtitle_path else None
            # Honor project.burn_subtitle: only burn SRT into video if user
            # opted in AND SRT exists. When False, SRT stays as sidecar file
            # but video has no on-screen burn-in (subtitle band shown via
            # template's caption.en layer only).
            should_burn = bool(getattr(project, "burn_subtitle", True)) and srt_path is not None
            await asyncio.to_thread(
                assemble_final_video,
                raw_video=result.webm_path,
                audio_files=audio_files,
                srt_path=srt_path if should_burn else None,
                out_path=output_path,
                burn_subtitle=should_burn,
            )
        except FFmpegError as exc:
            await fail(f"FFmpeg failed: {exc}")
            return

        repository.update_project(
            project_id,
            {"output_path": str(output_path), "status": "completed", "error": None},
        )
        await emit(
            "done",
            1.0,
            "Video đã sẵn sàng",
            payload={"output_path": str(output_path)},
        )

    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected pipeline error for %s", project_id)
        await fail(f"Unexpected error: {exc}")


def _log_task_completion(task: asyncio.Task) -> None:
    if task.cancelled():
        logger.warning("Pipeline task cancelled")
        return
    exc = task.exception()
    if exc:
        logger.error("Pipeline task crashed: %s", exc, exc_info=exc)
