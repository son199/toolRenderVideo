# Hyperframes

Self-contained HTML + CSS + GSAP video templates. The backend's render service serves
each template's directory as static content to Playwright, injects the storyboard JSON
into `window.__STORYBOARD__`, and records the resulting timeline.

## Folder contract

Each template lives in `templates/<id>/` and exposes the following files:

| File | Required | Purpose |
|---|---|---|
| `index.html` | ✅ | Skeleton markup. Use `data-slot="..."` attributes for content the renderer fills in (title, scene text, background image, …). Include `style.css`, `../../shared/subtitles.css`, GSAP CDN, and `animation.js`. |
| `style.css` | ✅ | Template-specific styling. Must handle both `9:16` (1080×1920) and `16:9` (1920×1080) via media queries or aspect-driven classes. |
| `animation.js` | ✅ | ES module exporting `buildTimeline(storyboard, audioMeta)` that returns a `gsap.timeline()` whose total duration matches `storyboard.total_duration_sec`. The renderer calls this once the page loads. |
| `meta.json` | ✅ | Metadata used by the backend to validate and pick the template (see schema below). |
| `preview.png` | optional | Thumbnail for the template picker (added later). |

## `meta.json` schema

```json
{
  "id": "news",
  "name": "News Flash",
  "description": "Tin tức nhanh, layout đen-đỏ, motion mạnh.",
  "supported_aspects": ["9:16", "16:9"],
  "max_scenes": 8,
  "default_duration_sec": 4.0
}
```

## Storyboard injected at runtime

```ts
window.__STORYBOARD__ = {
  title: string;
  aspect_ratio: "9:16" | "16:9";
  template: string;
  scenes: Array<{
    id: number;
    duration_sec: number;
    text: string;
    visual_prompt: string;
    style: string | null;
    voice: string | null;
  }>;
  total_duration_sec: number;
};

// Audio metadata (durations measured server-side after TTS):
window.__AUDIO_META__ = Array<{
  scene_id: number;
  audio_url: string;
  duration_sec: number;
  word_timings: Array<{ word: string; start: number; end: number }> | null;
}>;
```

`animation.js` must consume both and produce a single master GSAP timeline that the
renderer can `await` via `timeline.eventCallback("onComplete", resolve)`.

## Authoring a new template

1. `mkdir templates/<id>` and add the four required files.
2. Implement `buildTimeline` so the master timeline length equals
   `audioMeta.reduce((acc, m) => acc + m.duration_sec, 0)` (within ±50 ms).
3. Test in a browser by opening `templates/<id>/index.html?demo=1` with a
   `window.__STORYBOARD__` fixture (Sprint 4 will add a dev page that injects fixtures).
4. Add an entry to `meta.json` and the template appears in the frontend picker.

## Phase 1 templates

- `news/` — fast-cut news flash
- `promo/` — product/service promo
- `motivational/` — quote cards with subtle motion

Templates ship in Sprint 4.
