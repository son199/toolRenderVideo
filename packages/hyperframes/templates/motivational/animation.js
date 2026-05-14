/**
 * Motivational template — Animation Engine v3 (Cinematic 3-Phase)
 *
 * Architecture (mirror news v4 with SLOWER pacing for reflective mood):
 *   Every scene runs through 3 phases on the master timeline:
 *     [intro]  elements enter      (gentle fade + lift)
 *     [hold]   living loops        (slow breathing, soft drift)
 *     [outro]  shared blur-fade-up
 *
 * Scene types supported:
 *   question-hero | line-statement | quote-card | closing-card
 *   + legacy roles: question | line | quote | closing
 *
 * Mood preservation:
 *   - Slower intro fraction (0.34 vs news 0.28) — entries linger
 *   - crossfade between scenes (NOT lightFlash) — no jarring cuts
 *   - Push-in only on quote-card (emphasis), not on every scene
 *   - All hold tweens use sine.inOut with long periods (3-5s)
 *   - Ken Burns continues on .scene-bg across full video
 */

import {
  installCinematicTickerHints,
  pushIn,
  ambientFloat,
  crossfade,
} from "../../shared/cinematic.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGACY_ROLES = ["question", "line", "line", "quote", "closing"];
const SCENES_WITH_PUSHIN = new Set(["quote-card", "quote"]);

// Slower pacing than news/promo — motivational scenes linger
const INTRO_FRAC = 0.34;
const INTRO_CAP  = 2;     // intros can be longer (mood building)
const OUTRO_DUR  = 0.5;   // slower outro fade

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildTimeline(storyboard, audioMeta) {
  installCinematicTickerHints();

  const container = document.getElementById("scenes");
  const bg = document.getElementById("scene-bg");
  container.innerHTML = "";

  const scenes = storyboard.scenes.map((spec, idx) => {
    const duration = audioMeta?.[idx]?.duration_sec ?? spec.duration_sec ?? 6;
    const type = resolveType(spec, idx, storyboard.scenes.length);
    const el = createScene(spec, idx, type);
    container.appendChild(el);
    return { spec, el, duration, type };
  });

  const tl = window.gsap.timeline({ paused: false });
  const subtitleEl = document.getElementById("subtitle-text");
  const totalDur = scenes.reduce((acc, s) => acc + s.duration, 0);

  // ── Ambient cinematic layer ──
  // Strong Ken Burns on the bg image: scale 1.04 → 1.22 + diagonal translate.
  // Spans the full video. Sets the cinematic feel before any scene fires.
  if (bg) {
    tl.fromTo(bg,
      { scale: 1.04, x: -20, y: -12 },
      { scale: 1.22, x: 20, y: 12, duration: totalDur, ease: "none" },
      0);
  }

  // Light shaft: organic drift via ambientFloat (sinusoidal, not linear)
  const lightShaft = document.getElementById("light-shaft");
  if (lightShaft) {
    tl.set(lightShaft, { opacity: 0.75 }, 0);
    ambientFloat(tl, lightShaft, totalDur, { intensity: 80, periodSec: 18 });
  }

  // ── Scene loop ──
  let cursor = 0;

  scenes.forEach((scene, i) => {
    const introDur  = Math.min(scene.duration * INTRO_FRAC, INTRO_CAP);
    const outroDur  = OUTRO_DUR;
    const holdDur   = Math.max(scene.duration - introDur - outroDur, 0.5);
    const holdStart = cursor + introDur;
    const outroAt   = holdStart + holdDur;

    // Crossfade between scenes (motivational mood — NO lightFlash)
    if (i > 0) {
      crossfade(tl, null, scene.el, cursor - 0.1, 0.6);
    }

    tl.set(scene.el, { visibility: "visible" }, cursor);

    // Phase 1 — Intro (slower than news/promo)
    phaseIntro(tl, scene, cursor, introDur);

    // Cinematic camera move — quote-card only (mood emphasis)
    if (SCENES_WITH_PUSHIN.has(scene.type)) {
      pushIn(tl, scene.el, cursor, scene.duration, 1, 1.05);
    }

    // Phase 2 — Hold (contemplative loops)
    phaseHold(tl, scene, holdStart, holdDur);

    // Phase 3 — Outro (shared, slower)
    phaseOutro(tl, scene, outroAt, outroDur);
    tl.set(scene.el, { visibility: "hidden", y: 0, filter: "none" }, outroAt + outroDur);

    // Subtitle band = SHORT English supplement; body carries caption.vi
    const captionText =
      scene.spec.caption?.en ??
      scene.spec.caption?.vi ?? "";

    tl.call(() => {
      subtitleEl.textContent = captionText;
      subtitleEl.style.opacity = "1";
    }, null, cursor + 0.2);

    tl.call(() => { subtitleEl.style.opacity = "0"; }, null, outroAt + outroDur - 0.05);

    cursor += scene.duration;
  });

  return tl;
}

function resolveType(spec, idx, total) {
  if (spec.type) return spec.type;
  if (idx === 0) return "question";
  if (idx === total - 1) return "closing";
  if (idx === total - 2) return "quote";
  return "line";
}

// ─── Phase routers ────────────────────────────────────────────────────────────

function phaseIntro(tl, scene, t, dur) {
  switch (scene.type) {
    case "question-hero":
    case "question":      return introQuestionHero(tl, scene.el, scene.spec, t, dur);
    case "line-statement":
    case "line":          return introLineStatement(tl, scene.el, scene.spec, t, dur);
    case "quote-card":
    case "quote":         return introQuoteCard(tl, scene.el, scene.spec, t, dur);
    case "closing-card":
    case "closing":       return introClosingCard(tl, scene.el, scene.spec, t, dur);
    default:              return introFallback(tl, scene.el, t, dur);
  }
}

function phaseHold(tl, scene, t, dur) {
  switch (scene.type) {
    case "question-hero":
    case "question":      return holdQuestionHero(tl, scene.el, scene.spec, t, dur);
    case "line-statement":
    case "line":          return holdLineStatement(tl, scene.el, scene.spec, t, dur);
    case "quote-card":
    case "quote":         return holdQuoteCard(tl, scene.el, scene.spec, t, dur);
    case "closing-card":
    case "closing":       return holdClosingCard(tl, scene.el, scene.spec, t, dur);
    default:              break;
  }
}

function phaseOutro(tl, scene, t, dur) {
  // Shared outro: gentle fade with very mild blur — preserve mood
  tl.to(scene.el, {
    opacity: 0,
    y: -8,
    filter: "blur(2px)",
    duration: dur,
    ease: "power2.in",
  }, t);
}

// ─── INTRO implementations ────────────────────────────────────────────────────

function introQuestionHero(tl, el, spec, t, dur) {
  const eyebrow = el.querySelector(".question-eyebrow");
  const emoji   = el.querySelector(".question-emoji");
  const text    = el.querySelector(".question-text");

  tl.to(el, { opacity: 1, duration: dur * 0.7, ease: "power2.out" }, t);
  if (eyebrow) {
    tl.fromTo(eyebrow, { opacity: 0 }, { opacity: 1, duration: dur * 0.6 }, t);
  }
  if (emoji) {
    tl.fromTo(emoji,
      { opacity: 0, scale: 0.7, y: 8 },
      { opacity: 0.95, scale: 1, y: 0, duration: dur * 0.7, ease: "power2.out" }, t + 0.1);
  }
  if (text) {
    tl.fromTo(text,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: dur, ease: "power2.out" }, t + 0.25);
  }
}

function introLineStatement(tl, el, spec, t, dur) {
  const eyebrow = el.querySelector(".line-eyebrow");
  const line    = el.querySelector(".line-text");

  tl.to(el, { opacity: 1, duration: dur * 0.6 }, t);
  if (eyebrow) {
    tl.fromTo(eyebrow, { opacity: 0 }, { opacity: 1, duration: dur * 0.5 }, t);
  }
  if (line) {
    tl.fromTo(line,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: dur, ease: "power2.out" }, t + 0.2);
  }
}

function introQuoteCard(tl, el, spec, t, dur) {
  const mark   = el.querySelector(".quote-mark");
  const text   = el.querySelector(".quote-text");
  const source = el.querySelector(".quote-source");

  tl.to(el, { opacity: 1, duration: dur * 0.5 }, t);
  if (mark) {
    tl.fromTo(mark,
      { opacity: 0, y: 14, scale: 0.7 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }, t + 0.08);
  }
  if (text) {
    tl.fromTo(text,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: dur * 0.8, ease: "power2.out" }, t + 0.25);
  }
  if (source) {
    tl.fromTo(source,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + dur * 0.6);
  }
}

function introClosingCard(tl, el, spec, t, dur) {
  const card   = el.querySelector(".closing-card");
  const line   = el.querySelector(".closing-line");
  const footer = el.querySelector(".closing-footer");

  tl.to(el, { opacity: 1, duration: dur * 0.5 }, t);
  if (card) {
    tl.fromTo(card,
      { opacity: 0, scale: 0.96 },
      { opacity: 1, scale: 1, duration: dur * 0.7, ease: "power2.out" }, t);
  }
  if (line) {
    tl.fromTo(line,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: dur * 0.7, ease: "power2.out" }, t + 0.2);
  }
  if (footer) {
    tl.fromTo(footer,
      { opacity: 0 },
      { opacity: 0.85, duration: 0.6 }, t + dur * 0.55);
  }
}

function introFallback(tl, el, t, dur) {
  tl.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: dur * 0.7, ease: "power2.out" }, t);
}

// ─── HOLD implementations — slower & softer than news/promo ──────────────────
//
// Rules (same as news/promo):
//  1. Every hold adds ≥1 looping tween (repeat:-1 yoyo:true)
//  2. No two consecutive scenes share the same primary hold effect
//  3. Periods are LONGER here (3-5s) for reflective pacing

function holdQuestionHero(tl, el, spec, t, dur) {
  const emoji   = el.querySelector(".question-emoji");
  const text    = el.querySelector(".question-text");
  const eyebrow = el.querySelector(".question-eyebrow");

  // Emoji slow float (5s period — much slower than news/promo)
  if (emoji) {
    tl.to(emoji, {
      y: -5, duration: 2.5,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }

  // Question text very gentle Y drift — a "thinking" motion
  if (text) {
    tl.to(text, {
      y: -3, duration: 3.6,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.4);
  }

  // Eyebrow opacity breathe
  if (eyebrow) {
    tl.to(eyebrow, {
      opacity: 0.55, duration: 2.8,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.8);
  }
}

function holdLineStatement(tl, el, spec, t, dur) {
  const line     = el.querySelector(".line-text");
  const emphasis = el.querySelector(".line-emphasis");
  const eyebrow  = el.querySelector(".line-eyebrow");

  // Emphasis word soft amber glow breathe (the heart of motivational)
  if (emphasis) {
    tl.fromTo(emphasis,
      { textShadow: "0 0 10px rgba(255,200,80,0.25)" },
      { textShadow: "0 0 32px rgba(255,200,80,0.7)",
        duration: 2.4, ease: "sine.inOut", repeat: -1, yoyo: true },
      t + 0.3);
  }

  // Line subtle scale breath (1.005 — barely perceptible)
  if (line) {
    tl.to(line, {
      scale: 1.005,
      duration: 4.2, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }

  // Eyebrow subtle opacity drift
  if (eyebrow) {
    tl.to(eyebrow, {
      opacity: 0.5, duration: 3,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1);
  }
}

function holdQuoteCard(tl, el, spec, t, dur) {
  const mark    = el.querySelector(".quote-mark");
  const text    = el.querySelector(".quote-text");
  const source  = el.querySelector(".quote-source");
  const eyebrow = el.querySelector(".quote-eyebrow");

  // Quote mark gentle scale + opacity drift (Y-axis avoided to not conflict with intro)
  if (mark) {
    tl.to(mark, {
      opacity: 0.55, scale: 1.04,
      duration: 3.4, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.2);
  }

  // Text very subtle vertical drift (contemplation breathing)
  if (text) {
    tl.to(text, {
      y: -2,
      duration: 3.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.5);
  }

  // Source line opacity shimmer
  if (source) {
    tl.to(source, {
      opacity: 0.6,
      duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1);
  }

  // Eyebrow soft breathe
  if (eyebrow) {
    tl.to(eyebrow, {
      opacity: 0.55, duration: 3.2,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1.4);
  }
}

function holdClosingCard(tl, el, spec, t, dur) {
  const card    = el.querySelector(".closing-card");
  const line    = el.querySelector(".closing-line");
  const footer  = el.querySelector(".closing-footer");
  const eyebrow = el.querySelector(".closing-eyebrow");

  // Card border opacity breathe (subtle frame breathing)
  if (card) {
    tl.to(card, {
      boxShadow: "0 12px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
      duration: 3, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }

  // Line gentle scale breath — anchor of message
  if (line) {
    tl.to(line, {
      scale: 1.006,
      duration: 4, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.4);
  }

  // Footer shimmer
  if (footer) {
    tl.to(footer, {
      opacity: 0.6,
      duration: 2.4, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.8);
  }

  // Eyebrow drift
  if (eyebrow) {
    tl.to(eyebrow, {
      opacity: 0.55, duration: 3.4,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1.2);
  }
}

// ============================================================
// Scene builders — DOM construction per type
// ============================================================

function createScene(spec, idx, type) {
  const el = document.createElement("section");
  el.className = "scene";
  el.dataset.sceneId = String(spec.id ?? idx);
  el.dataset.type = type;
  switch (type) {
    case "question-hero":
    case "question":      buildQuestionHero(el, spec); break;
    case "line-statement":
    case "line":          buildLineStatement(el, spec); break;
    case "quote-card":
    case "quote":         buildQuoteCard(el, spec); break;
    case "closing-card":
    case "closing":       buildClosingCard(el, spec); break;
    default:              buildFallbackScene(el, spec);
  }
  return el;
}

function buildQuestionHero(el, spec) {
  el.classList.add("s-question");
  el.appendChild(dom("div", "question-eyebrow", "MỘT CÂU HỎI"));
  if (spec.emoji) {
    const e = dom("div", "question-emoji");
    e.textContent = spec.emoji;
    el.appendChild(e);
  }
  const text = spec.question ?? spec.text ?? "";
  el.appendChild(dom("blockquote", "question-text", text));
}

function buildLineStatement(el, spec) {
  el.classList.add("s-line");
  el.appendChild(dom("div", "line-eyebrow", "MỘT GÓC NHÌN"));
  const lineText = spec.line ?? spec.text ?? "";
  const line = dom("h1", "line-text");
  if (spec.emphasis) {
    const idx = lineText.toLowerCase().indexOf(String(spec.emphasis).toLowerCase());
    if (idx >= 0) {
      const before = lineText.slice(0, idx);
      const middle = lineText.slice(idx, idx + spec.emphasis.length);
      const after  = lineText.slice(idx + spec.emphasis.length);
      if (before) line.appendChild(txt(before));
      const emEl = dom("em", "line-emphasis");
      emEl.textContent = middle;
      line.appendChild(emEl);
      if (after) line.appendChild(txt(after));
    } else {
      line.textContent = lineText;
    }
  } else {
    line.textContent = lineText;
  }
  el.appendChild(line);
}

function buildQuoteCard(el, spec) {
  el.classList.add("s-quote");
  el.appendChild(dom("div", "quote-eyebrow", "TRÍCH DẪN"));
  el.appendChild(dom("div", "quote-mark", "“"));
  el.appendChild(dom("blockquote", "quote-text", spec.text ?? ""));
  if (spec.attr) el.appendChild(dom("div", "quote-source", "— " + spec.attr));
}

function buildClosingCard(el, spec) {
  el.classList.add("s-closing");
  el.appendChild(dom("div", "closing-eyebrow", "MỘT BƯỚC NHỎ"));
  const card = dom("div", "closing-card");
  card.appendChild(dom("div", "closing-line", spec.line ?? spec.text ?? ""));
  if (spec.footer) card.appendChild(dom("div", "closing-footer", spec.footer));
  el.appendChild(card);
}

function buildFallbackScene(el, spec) {
  el.classList.add("s-line");
  const t = dom("h1", "line-text");
  t.textContent = spec.text ?? spec.line ?? spec.question ?? "";
  el.appendChild(t);
}

// ============================================================
// Helpers
// ============================================================

function dom(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

function txt(s) {
  return document.createTextNode(String(s));
}
