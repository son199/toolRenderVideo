// Runner bootstrap shared by every template.
//
// Each template's `index.html` ends with:
//   <script type="module">
//     import { runTemplate } from "../../shared/runner.js";
//     import { buildTimeline } from "./animation.js";
//     runTemplate(buildTimeline);
//   </script>
//
// The runner:
//   1. Reads `window.__STORYBOARD__` and `window.__AUDIO_META__` if Playwright /
//      the dev preview injected them.
//   2. Falls back to `fixture.json` sitting next to the template's index.html.
//   3. Sets `data-aspect` on <body> for CSS sizing.
//   4. Calls `buildTimeline(storyboard, audioMeta)` for the master GSAP timeline.
//   5. Wires per-scene audio playback in "preview" mode (set
//      `window.__RENDER_MODE__ = "record"` to skip audio — Playwright muxes audio
//      separately in Sprint 5).
//   6. Exposes `window.__HYPERFRAMES_DONE__ = true` on timeline complete so the
//      Playwright recorder can stop recording deterministically.

export async function runTemplate(buildTimeline) {
  const loading = document.getElementById("runner-loading");
  try {
    const { storyboard, audioMeta } = await resolveData();
    document.body.dataset.aspect = storyboard.aspect_ratio || "9:16";
    document.title = storyboard.title || document.title;

    // Phase 2G — apply per-storyboard theme to stage so CSS palette flips.
    // theme comes from analyzer (via storyboard_agent) or LLM-emitted JSON.
    // Templates listen via .stage.cinema[data-grade="X"][data-theme="Y"] selectors.
    const theme = storyboard.theme || storyboard?.meta?.theme || "default";
    const stage = document.querySelector(".stage");
    if (stage) stage.dataset.theme = theme;
    document.body.dataset.theme = theme;  // also on body for global CSS access

    const mode = window.__RENDER_MODE__ || "preview";
    const audioElements = mode === "preview" ? createAudioElements(audioMeta) : [];

    const timeline = buildTimeline(storyboard, audioMeta);
    if (!timeline) {
      throw new Error("buildTimeline returned no timeline");
    }

    if (audioElements.length) {
      attachAudio(timeline, audioElements, audioMeta);
    }

    const finish = () => {
      if (window.__HYPERFRAMES_DONE__) return;
      window.__HYPERFRAMES_DONE__ = true;
      audioElements.forEach((a) => a.pause());
    };

    timeline.eventCallback("onComplete", finish);

    // Hold-phase tweens use `repeat: -1` → timeline.duration() is Infinity → its
    // own onComplete never fires. Schedule a deterministic finish at the sum of
    // scene durations (+0.5s tail) using gsap.delayedCall so it lives on the
    // same ticker Playwright uses (deterministic in record mode).
    const totalDur = (audioMeta || []).reduce(
      (acc, m) => acc + (Number(m.duration_sec) || 0),
      0,
    );
    if (totalDur > 0 && window.gsap) {
      window.gsap.delayedCall(totalDur + 0.5, finish);
    }

    if (loading) loading.dataset.hidden = "true";

    // Expose for Playwright (and dev preview controls).
    window.__HYPERFRAMES_TIMELINE__ = timeline;
  } catch (err) {
    console.error("[runner] failed:", err);
    if (loading) {
      loading.textContent = `Runner error: ${err.message || err}`;
      loading.style.color = "#f87171";
    }
    window.__HYPERFRAMES_ERROR__ = String(err && err.message ? err.message : err);
  }
}

async function resolveData() {
  let storyboard = window.__STORYBOARD__;
  let audioMeta = window.__AUDIO_META__;

  // Dev preview (`dev.html`) writes an override into sessionStorage then
  // reloads the iframe — pick it up before falling back to fixture.json.
  if (!storyboard) {
    try {
      const raw = sessionStorage.getItem("__HYPERFRAMES_OVERRIDE__");
      if (raw) {
        const override = JSON.parse(raw);
        if (override.storyboard) {
          storyboard = override.storyboard;
          audioMeta = audioMeta || override.audioMeta || null;
        }
      }
    } catch (e) {
      console.warn("[runner] override parse failed:", e);
    }
  }

  if (!storyboard) {
    const res = await fetch("./fixture.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`fixture.json fetch failed: ${res.status}`);
    const fixture = await res.json();
    storyboard = fixture.storyboard || fixture;
    audioMeta = audioMeta || fixture.audio_meta || synthesizeAudioMeta(storyboard);
  }

  if (!audioMeta) audioMeta = synthesizeAudioMeta(storyboard);

  return { storyboard, audioMeta };
}

function synthesizeAudioMeta(storyboard) {
  // Used in dev preview when running without a real backend project — fall back
  // to the storyboard's declared durations and skip audio.
  return storyboard.scenes.map((s) => ({
    scene_id: s.id,
    audio_url: null,
    duration_sec: s.duration_sec,
    word_timings: null,
  }));
}

function createAudioElements(audioMeta) {
  return audioMeta.map((meta) => {
    if (!meta.audio_url) return null;
    const audio = new Audio(meta.audio_url);
    audio.preload = "auto";
    return audio;
  });
}

function attachAudio(timeline, audioElements, audioMeta) {
  let offset = 0;
  audioMeta.forEach((meta, i) => {
    const audio = audioElements[i];
    if (audio) {
      timeline.call(
        () => {
          audio.currentTime = 0;
          audio.play().catch((e) => console.warn("audio play blocked:", e));
        },
        null,
        offset,
      );
    }
    offset += meta.duration_sec;
  });
}
