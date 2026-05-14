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
                    # Sửa spacing cho các trường text/caption...
                    if "caption" in scene and isinstance(scene["caption"], dict):
                        for capk in ("vi", "en"):
                            if capk in scene["caption"] and isinstance(scene["caption"][capk], str):
                                scene["caption"][capk] = fix_spacing(scene["caption"][capk])
                    
                    # Đảm bảo luôn có text (Remotion sẽ dùng word_timings là chính, nhưng cần text dự phòng)
                    scene["text"] = narration_text(scene)

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
            
            scenes_input = []
            if project.storyboard and isinstance(project.storyboard, dict):
                scenes_input = project.storyboard.get("scenes") or []

            try:
                # 2. Định nghĩa hàm xử lý cho từng scene
                async def process_scene(i, scene):
                    scene_id = int(scene["id"])
                    voice = scene.get("voice") or project.voice or settings.tts_default_voice
                    out_path = audio_dir / f"scene_{scene_id:02d}.mp3"
                    text = narration_text(scene)
                    import re
                    if not text or not re.search(r'[a-zA-Z0-9À-ỹ]', text):
                        text = "Chuyển cảnh."

                    result = await tts.synthesize(text=text, voice=voice, out_path=out_path)
                    
                    import random
                    def get_mixkit_video(prompt: str) -> str:
                        prompt = (prompt or "").lower()
                        if "tech" in prompt or "hacker" in prompt or "server" in prompt or "code" in prompt:
                            return random.choice([
                                "https://assets.mixkit.co/videos/preview/mixkit-server-room-with-rows-of-computer-servers-and-blinking-lights-15822-large.mp4",
                                "https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-a-computer-at-night-17631-large.mp4"
                            ])
                        if "money" in prompt or "finance" in prompt or "crypto" in prompt or "business" in prompt:
                            return "https://assets.mixkit.co/videos/preview/mixkit-falling-crypto-coins-39908-large.mp4"
                        return random.choice([
                            "https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-connection-with-nodes-and-lines-27488-large.mp4",
                            "https://assets.mixkit.co/videos/preview/mixkit-spinning-particles-in-the-shape-of-a-sphere-46903-large.mp4",
                            "https://assets.mixkit.co/videos/preview/mixkit-neon-lights-in-the-shape-of-a-tunnel-34208-large.mp4"
                        ])

                    return {
                        **scene,
                        "audio_path": str(result.audio_path),
                        "video_path": get_mixkit_video(scene.get("visual_prompt", "")),
                        "duration_sec": result.duration_sec,
                        "word_timings": (timings_to_dict(result.word_timings) if result.word_timings else None),
                    }

                # 3. Thực thi song song toàn bộ các tác vụ TTS
                await emit("tts", 0.35, f"Đang sinh song song audio cho {len(scenes_input)} scenes...")
                tasks = [process_scene(i, scene) for i, scene in enumerate(scenes_input)]
                updated_scenes = await asyncio.gather(*tasks)
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

        # ----- 4. Render (Remotion Engine) -----
        project = repository.get_project(project_id) or project
        repository.update_project(project_id, {"status": "rendering"})
        await emit("render", 0.65, "Đang Render Video bằng Remotion Engine (React)...")

        output_path = settings.storage_output / f"{project_id}.mp4"
        
        try:
            from app.services.render import RemotionError, render_remotion
            
            async def render_progress(msg: str) -> None:
                await emit("render", 0.75, msg)
                
            await render_remotion(
                project_id=str(project.id),
                scenes=project.scenes or [],
                template=project.template,
                output_path=output_path,
                on_progress=render_progress,
            )
            await emit("render", 0.95, "Render thành công!")
        except RemotionError as exc:
            logger.exception("Remotion Render failed for %s", project.id)
            await fail(f"Remotion Render failed: {exc}")
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
