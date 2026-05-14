/**
 * Hyperframes — Cinematic helpers (Phase 2E)
 *
 * All helpers take an existing GSAP timeline `tl` and append tweens at
 * absolute time `t`. They never create their own paused timeline, so
 * Playwright's `__HYPERFRAMES_DONE__` flag still fires when the master
 * timeline completes.
 *
 * Production constraints:
 * - Transform / opacity / filter only.
 * - Filter blur capped at 6px (motion) / 8px (static — see cinematic.css).
 * - Ease whitelist: power2.out, power3.inOut, expo.out, back.out(≤1.4).
 * - No bounce / elastic. No CSS @keyframes triggered from here.
 *
 * Call `installCinematicTickerHints()` once before building the timeline
 * so GSAP runs frame-perfect (no lagSmoothing) — important for Playwright
 * deterministic recording at 30fps.
 */

const GSAP = () => window.gsap; // late-binding so script load order doesn't matter

// ============================================================
// One-time setup
// ============================================================

let _installed = false;
export function installCinematicTickerHints() {
  if (_installed || !GSAP()) return;
  // Disable GSAP's lagSmoothing — Playwright records frame-by-frame, no
  // tab throttling to compensate for. We want exact timeline times.
  GSAP().ticker.lagSmoothing(0);
  // Force GPU compositing on every tween
  GSAP().defaults({ force3D: true });
  _installed = true;
}

// ============================================================
// Camera simulation
// ============================================================

export function pushIn(tl, target, t, dur, fromScale = 1, toScale = 1.05) {
  if (!target) return;
  tl.fromTo(target,
    { scale: fromScale, transformOrigin: "50% 50%" },
    { scale: toScale, duration: dur, ease: "power2.out" },
    t);
}

export function pullOut(tl, target, t, dur, fromScale = 1.06, toScale = 1) {
  if (!target) return;
  tl.fromTo(target,
    { scale: fromScale, transformOrigin: "50% 50%" },
    { scale: toScale, duration: dur, ease: "power2.out" },
    t);
}

/**
 * Layered parallax: bg drifts furthest, mid drifts mid, fg static.
 * Direction alternates per scene id (passed in via opts.seed) so the
 * motion never feels mechanical across cuts.
 */
export function parallaxLayers(tl, layers, t, dur, opts = {}) {
  const { intensity = 1, seed = 0 } = opts;
  const dir = (seed % 2 === 0) ? 1 : -1;
  if (layers.bg) {
    tl.fromTo(layers.bg,
      { x: 0, y: 0 },
      { x: dir * 6 * intensity, y: dir * 3 * intensity, duration: dur, ease: "power1.inOut" },
      t);
  }
  if (layers.mid) {
    tl.fromTo(layers.mid,
      { x: 0, y: 0 },
      { x: dir * -14 * intensity, y: dir * -6 * intensity, duration: dur, ease: "power1.inOut" },
      t);
  }
}

/**
 * Subtle handheld shake. Deterministic — uses a fixed sin/cos pattern
 * seeded by `seed` so two runs with the same storyboard produce identical
 * frames.
 */
export function handheldShake(tl, target, t, dur, amplitude = 2, seed = 0) {
  if (!target) return;
  const steps = Math.max(4, Math.round(dur * 8));
  const phase = seed * 0.7;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const localT = t + u * dur;
    const sx = Math.sin(u * 6.28 * 1.2 + phase) * amplitude;
    const sy = Math.cos(u * 6.28 * 1.5 + phase * 1.3) * amplitude * 0.7;
    tl.set(target, { x: sx, y: sy }, localT);
  }
  tl.set(target, { x: 0, y: 0 }, t + dur);
}

// ============================================================
// Transitions
// ============================================================

/**
 * White light flash. Pops the .cinema-flash overlay briefly.
 * Use sparingly — 0.14-0.20s peak around scene cuts.
 */
export function lightFlash(tl, t, dur = 0.18, peak = 0.45) {
  const flash = document.querySelector(".cinema-flash");
  if (!flash) return;
  tl.fromTo(flash,
    { opacity: 0 },
    { opacity: peak, duration: dur * 0.45, ease: "power2.out" },
    t);
  tl.to(flash,
    { opacity: 0, duration: dur * 0.55, ease: "power2.in" },
    t + dur * 0.45);
}

/**
 * Blur-cut between scenes:
 *   - outgoing: scale down 1.0→0.96 + blur 0→6 + opacity 1→0 (60% of dur)
 *   - incoming: blur 6→0 + opacity 0→1 (60% delayed by 30%)
 */
export function blurCut(tl, outEl, inEl, t, dur = 0.42) {
  const outDur = dur * 0.6;
  const inDur = dur * 0.6;
  const inDelay = t + dur * 0.3;
  if (outEl) {
    tl.to(outEl,
      { scale: 0.96, filter: "blur(6px)", opacity: 0, duration: outDur, ease: "power2.in" },
      t);
  }
  if (inEl) {
    tl.fromTo(inEl,
      { filter: "blur(6px)", opacity: 0 },
      { filter: "blur(0px)", opacity: 1, duration: inDur, ease: "power3.out" },
      inDelay);
  }
}

/**
 * Soft crossfade — for motivational where mood matters more than punch.
 */
export function crossfade(tl, outEl, inEl, t, dur = 0.7) {
  if (outEl) {
    tl.to(outEl, { opacity: 0, duration: dur, ease: "power2.inOut" }, t);
  }
  if (inEl) {
    tl.fromTo(inEl, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power2.inOut" }, t);
  }
}

// ============================================================
// Kinetic typography
// ============================================================

/**
 * Split text by whitespace into <span class="kinetic-word">…</span> spans
 * inserted into `container`. Returns the array of word elements.
 */
export function splitWords(container, text) {
  container.innerHTML = "";
  const words = String(text || "").split(/(\s+)/);
  const els = [];
  words.forEach((chunk) => {
    if (!chunk) return;
    if (/^\s+$/.test(chunk)) {
      container.appendChild(document.createTextNode(chunk));
      return;
    }
    const span = document.createElement("span");
    span.className = "kinetic-word";
    span.textContent = chunk;
    container.appendChild(span);
    els.push(span);
  });
  return els;
}

/**
 * Split text into per-character <span class="kinetic-letter">…</span>.
 * Whitespace preserved as text nodes (not wrapped — keeps line break).
 */
export function splitLetters(container, text) {
  container.innerHTML = "";
  const els = [];
  for (const ch of String(text || "")) {
    if (/\s/.test(ch)) {
      container.appendChild(document.createTextNode(ch));
      continue;
    }
    const span = document.createElement("span");
    span.className = "kinetic-letter";
    span.textContent = ch;
    container.appendChild(span);
    els.push(span);
  }
  return els;
}

/**
 * Animate a list of .kinetic-word spans into view with blur removal +
 * gentle y motion. Stagger defaults to 0.045s — fast enough to feel
 * kinetic, slow enough to be readable.
 */
export function kineticWords(tl, words, t, opts = {}) {
  if (!words || !words.length) return;
  const { stagger = 0.045, dur = 0.55 } = opts;
  tl.fromTo(words,
    { opacity: 0, y: 24, filter: "blur(6px)" },
    {
      opacity: 1, y: 0, filter: "blur(0px)",
      duration: dur,
      stagger: { each: stagger, from: "start" },
      ease: "power3.out",
    },
    t);
}

/**
 * Per-letter reveal — used on the hero headline (scene 0) only.
 * Stagger 0.022s feels expensive and premium without being slow.
 */
export function kineticLetters(tl, letters, t, opts = {}) {
  if (!letters || !letters.length) return;
  const { stagger = 0.022, dur = 0.6 } = opts;
  tl.fromTo(letters,
    { opacity: 0, y: 20, filter: "blur(5px)", scale: 0.9 },
    {
      opacity: 1, y: 0, filter: "blur(0px)", scale: 1,
      duration: dur,
      stagger: { each: stagger, from: "start" },
      ease: "expo.out",
    },
    t);
}

// ============================================================
// Continuous effects
// ============================================================

/**
 * Slow ambient float — subtle secondary motion on bg/mid/glow elements.
 * `totalDur` should be ≥ video total to avoid mid-video reset jolt.
 */
export function ambientFloat(tl, el, totalDur, opts = {}) {
  if (!el) return;
  const { intensity = 4, periodSec = 8 } = opts;
  // Build a sinusoidal path across totalDur using set() at 0.5s grid —
  // GSAP will tween between sets with default ease.
  const steps = Math.max(4, Math.round(totalDur / 0.5));
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * (totalDur / periodSec) * Math.PI * 2;
    tl.to(el, {
      x: Math.sin(u) * intensity,
      y: Math.cos(u * 0.7) * intensity * 0.6,
      duration: 0.5,
      ease: "sine.inOut",
    }, i * 0.5);
  }
}

/**
 * Glow pulse — repeats text-shadow + opacity yoyo. Use on CTA URL,
 * hero accent word. Returns the inserted tween for caller cleanup if
 * needed (rare).
 */
export function glowPulse(tl, el, t, opts = {}) {
  if (!el) return;
  const {
    color = "rgba(253, 230, 138, 0.65)",
    period = 1.2,
    repeats = 0, // 0 = no repeat (do `repeat: -1` if you want infinite)
  } = opts;
  const blurMid = 32;
  const blurMax = 56;
  tl.fromTo(el,
    { textShadow: `0 0 ${blurMid}px ${color}` },
    {
      textShadow: `0 0 ${blurMax}px ${color}`,
      duration: period / 2,
      ease: "sine.inOut",
      repeat: repeats,
      yoyo: true,
    },
    t);
}

/**
 * Chromatic drift — RGB-style offset using a single transform.
 * NOT a real blend; just shifts the text by 1-2px horizontally during
 * the entrance for a "premium AI commercial" feel. Used on hero/cta.
 */
export function chromaticDrift(tl, target, t, dur, magnitude = 2) {
  if (!target) return;
  tl.fromTo(target,
    { x: magnitude * -1 },
    { x: 0, duration: dur, ease: "power3.out" },
    t);
}

// ============================================================
// Composite presets — used directly by template animation.js
// ============================================================

/**
 * "Cinematic reveal" — full preset that combines pushIn + kineticWords.
 * Useful default for any hero-style scene.
 */
export function cinematicHeroReveal(tl, opts) {
  const { stage, words, t, dur, fromScale = 1, toScale = 1.05 } = opts;
  if (stage) pushIn(tl, stage, t, dur, fromScale, toScale);
  if (words) kineticWords(tl, words, t + 0.1, { stagger: 0.05, dur: dur * 0.7 });
}

/**
 * "Cinematic cut" — composite preset: blurCut between scenes + optional
 * lightFlash overlap. Defaults are safe for news/promo pacing.
 */
export function cinematicCut(tl, outEl, inEl, t, opts = {}) {
  const { dur = 0.42, flash = true } = opts;
  if (flash) lightFlash(tl, t, 0.16, 0.4);
  blurCut(tl, outEl, inEl, t, dur);
}
