import asyncio
import json
import logging
import os
import shutil
import urllib.request
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

class RemotionError(Exception):
    """Raised when Remotion fails to produce a video."""

async def render_remotion(
    *,
    project_id: str,
    scenes: list[dict[str, Any]],
    template: str,
    output_path: Path,
    on_progress: Any = None,
) -> Path:
    """Render a video using Remotion Engine.
    
    1. Prepares the public folder by downloading remote videos and copying local audio.
    2. Writes props.json for the Remotion engine.
    3. Executes the Remotion CLI.
    """
    settings = get_settings()
    remotion_dir = settings.remotion_dir
    public_dir = remotion_dir / "public" / project_id
    public_dir.mkdir(parents=True, exist_ok=True)
    
    async def download_asset(url: str, dst: Path):
        """Download asset with curl to bypass 403 errors on Windows."""
        try:
            if dst.exists() and dst.stat().st_size > 0:
                return
            
            import subprocess
            
            # Sử dụng curl (có sẵn trên Windows 10+) với đầy đủ headers giả lập
            cmd = [
                'curl', '-L',
                '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                '-e', 'https://mixkit.co/',
                '--retry', '3',
                '--retry-delay', '2',
                url,
                '-o', str(dst)
            ]
            
            def _run_curl():
                return subprocess.run(cmd, capture_output=True, check=True)
            
            await asyncio.to_thread(_run_curl)
        except Exception as e:
            logger.warning(f"Curl download failed for {url}: {e}")
            # Nếu curl thất bại, thử dùng urllib làm phương án dự phòng cuối cùng
            try:
                opener = urllib.request.build_opener()
                opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
                def _do_urllib():
                    with opener.open(url) as response, dst.open("wb") as out_file:
                        out_file.write(response.read())
                await asyncio.to_thread(_do_urllib)
            except Exception:
                raise

    # 1. Asset Preparation (Video, Audio, and Background Images)
    remotion_scenes = []
    for i, s in enumerate(scenes):
        s_copy = dict(s)
        
        # Handle Audio
        if s.get("audio_path"):
            audio_src = Path(s["audio_path"])
            audio_dst = public_dir / audio_src.name
            if audio_src.exists():
                shutil.copy2(audio_src, audio_dst)
            s_copy["audio_path"] = f"{project_id}/{audio_src.name}"
            
        # Skip background image download for faster testing (using CSS background instead)
        s_copy["background_image"] = None

        # Handle Video (Download if remote URL)
        video_url = s.get("video_path")
        if video_url and video_url.startswith("http"):
            try:
                video_filename = video_url.split("/")[-1].split("?")[0]
                if not video_filename.endswith(".mp4"):
                    video_filename += ".mp4"
                
                video_dst = public_dir / video_filename
                if on_progress:
                    await on_progress(f"Đang tải video nền: {video_filename}...")
                
                await download_asset(video_url, video_dst)
                
                # Kiểm tra nếu file quá nhỏ (< 100KB) thì coi như lỗi (tránh file 403 giả danh mp4)
                if video_dst.stat().st_size < 100 * 1024:
                    logger.warning(f"Video {video_filename} is too small, likely corrupted. Skipping.")
                    video_dst.unlink(missing_ok=True)
                    s_copy["video_path"] = None
                else:
                    s_copy["video_path"] = f"{project_id}/{video_filename}"
            except Exception:
                s_copy["video_path"] = None 
        
        remotion_scenes.append(s_copy)

    # 2. Write props.json
    props_path = remotion_dir / "props.json"
    with props_path.open("w", encoding="utf-8") as f:
        json.dump({"scenes": remotion_scenes, "template": template}, f, ensure_ascii=False)

    # 3. Run Remotion CLI — flags chọn theo machine spec (config-driven)
    cpu_count = os.cpu_count() or 4
    if settings.render_low_resource_mode:
        # Máy không có GPU / share resource: software GL + ít CPU
        concurrency = settings.render_concurrency or max(1, cpu_count // 4)
        gl_flag = "swiftshader"
        mode_label = "low-resource (software GL)"
    else:
        # Máy bình thường: ANGLE (DirectX/Metal-backed) + nhiều CPU
        concurrency = settings.render_concurrency or max(1, min(cpu_count - 2, 16))
        gl_flag = "angle"
        mode_label = "standard (hardware GL)"

    # Bảo vệ tuyệt đối: không vượt số core thực để tránh validate-concurrency error
    concurrency = max(1, min(concurrency, cpu_count))

    if on_progress:
        await on_progress(f"Đang Render — {mode_label}, concurrency={concurrency}...")

    cmd = (
        f'npx remotion render src/index.ts MainVideo "{output_path.absolute()}" '
        f'--props ./props.json --concurrency={concurrency} --codec=h264 --pixel-format=yuv420p '
        f'--gl={gl_flag} --timeout=90000'
    )

    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--max-old-space-size=4096"
    
    proc = await asyncio.create_subprocess_shell(
        cmd,
        cwd=str(remotion_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )
    
    stdout, stderr = await proc.communicate()
    
    if proc.returncode != 0:
        err_msg = stderr.decode().strip() or stdout.decode().strip()
        logger.error(f"Remotion Render Failed: {err_msg}")
        raise RemotionError(f"Remotion Render Failed: {err_msg}")

    return output_path
