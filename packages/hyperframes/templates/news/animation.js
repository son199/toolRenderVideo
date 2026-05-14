/**
 * News Flash — Animation Engine v4  (Cinematic 3-Phase)
 *
 * Architecture:
 *   Every scene runs through 3 phases on the GSAP master timeline:
 *     [intro]  elements enter  (slide/scale/fade in)
 *     [hold]   living loops    (float, pulse, counter-up, type-in, scanline)
 *     [outro]  elements exit   (blur/slide/fade out)
 *
 * Scene types supported:
 *   hero-text | stats-grid | terminal | code-diff | quote | cta-url
 *   + legacy: hook | stats | detail | impact | cta
 *
 * Cinematic layer (preserved from v3):
 *   - Camera push-in on hero/quote scenes
 *   - lightFlash on every scene cut
 *   - Ambient glow blob drift across full video
 */

import {
  installCinematicTickerHints,
  pushIn,
  pullOut,
  ambientFloat,
  lightFlash,
} from "../../shared/cinematic.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGACY_SCENE_TYPES = ["hook", "stats", "detail", "impact", "quote", "cta"];
const CODE_TOKEN_RE = /\b(CVE-[\d-]+|SMB|445|443|80|v\d[\d.]*|[A-Z]{2,6}-\d{4,})\b/g;
const SCENES_WITH_PUSHIN  = new Set(["hero-text", "hook", "quote", "impact"]);
const SCENES_WITH_PULLOUT = new Set(["cta-url", "cta"]);

// Timing split: intro takes this fraction of scene duration (max-capped)
const INTRO_FRAC  = 0.28;
const INTRO_CAP   = 1.4;   // seconds — intro never longer than this
const OUTRO_DUR   = 0.32;  // fixed outro duration

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildTimeline(storyboard, audioMeta) {
  installCinematicTickerHints();

  const container = document.getElementById("scenes");
  container.innerHTML = "";

  // Random sticker emoji
  const sticker = document.getElementById("sticker-emoji");
  if (sticker) {
    const emojis = ["🔥","🚨","📰","⚡","🚀","💥","📢","🦾","🌐","⚠️","🎯","📡"];
    sticker.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  }

  // Build scene objects
  const scenes = storyboard.scenes.map((spec, idx) => {
    const duration = audioMeta?.[idx]?.duration_sec ?? spec.duration_sec ?? 4;
    const type = spec.type ?? LEGACY_SCENE_TYPES[idx] ?? "detail";
    const el = createScene(spec, idx, type);
    container.appendChild(el);
    return { spec, el, duration, type };
  });

  const tl = window.gsap.timeline({ paused: false });
  const subtitleEl = document.getElementById("subtitle-text");
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);

  // ── Ambient cinematic layer: glow blob drift across full video ──
  const blobRed  = document.getElementById("glow-blob-red");
  const blobCyan = document.getElementById("glow-blob-cyan");
  if (blobRed)  ambientFloat(tl, blobRed,  totalDur, { intensity: 8, periodSec: 12 });
  if (blobCyan) ambientFloat(tl, blobCyan, totalDur, { intensity: 6, periodSec: 10 });

  // ── Scene loop ──
  let cursor = 0;

  scenes.forEach((scene, i) => {
    const introDur  = Math.min(scene.duration * INTRO_FRAC, INTRO_CAP);
    const outroDur  = OUTRO_DUR;
    const holdDur   = Math.max(scene.duration - introDur - outroDur, 0.4);
    const holdStart = cursor + introDur;
    const outroAt   = holdStart + holdDur;

    // Flash cut transition (skip scene 0 — no incoming)
    if (i > 0) lightFlash(tl, cursor - 0.08, 0.16, 0.4);

    tl.set(scene.el, { visibility: "visible" }, cursor);

    // Phase 1 — Intro
    phaseIntro(tl, scene, cursor, introDur);

    // Cinematic camera move layered on top of intro
    if (SCENES_WITH_PUSHIN.has(scene.type)) {
      pushIn(tl, scene.el, cursor, scene.duration, 1, 1.05);
    } else if (SCENES_WITH_PULLOUT.has(scene.type)) {
      pullOut(tl, scene.el, cursor, scene.duration, 1.06, 1);
    }

    // Phase 2 — Hold (living loops)
    phaseHold(tl, scene, holdStart, holdDur);

    // Phase 3 — Outro
    phaseOutro(tl, scene, outroAt, outroDur);
    tl.set(scene.el, { visibility: "hidden", y: 0, filter: "none" }, outroAt + outroDur);

    // Subtitle sync — prefer SHORT English caption (supplement role).
    // Body (chỗ giữa) đã render đầy đủ caption.vi / text per scene type.
    // Subtitle band lấy caption.en ngắn để 2 vùng KHÔNG trùng nội dung.
    // Empty string fallback nếu không có caption.en (rather than dupe with body).
    const captionText =
      scene.spec.caption?.en ??
      scene.spec.caption?.vi ?? "";

    tl.call(() => {
      subtitleEl.textContent = captionText;
      subtitleEl.style.opacity = "1";
    }, null, cursor + 0.15);

    // Last scene: slide up CTA bar
    if (i === scenes.length - 1) {
      const ctaBar = document.getElementById("cta-bar");
      ctaBar.textContent = scene.spec.label ?? scene.spec.text ?? "";
      tl.to(ctaBar, { yPercent: 0, duration: 0.55, ease: "power3.out" }, outroAt - 0.5);
      tl.call(() => { subtitleEl.style.opacity = "0"; }, null, outroAt + outroDur);
    } else {
      tl.call(() => { subtitleEl.style.opacity = "0"; }, null, outroAt + outroDur - 0.05);
    }

    cursor += scene.duration;
  });

  return tl;
}

// ─── Phase routers ────────────────────────────────────────────────────────────

function phaseIntro(tl, scene, t, dur) {
  switch (scene.type) {
    case "hero-text":  return introHeroText(tl, scene.el, scene.spec, t, dur);
    case "stats-grid": return introStatsGrid(tl, scene.el, scene.spec, t, dur);
    case "terminal":   return introTerminal(tl, scene.el, scene.spec, t, dur);
    case "code-diff":  return introCodeDiff(tl, scene.el, scene.spec, t, dur);
    case "quote":      return introQuote(tl, scene.el, scene.spec, t, dur);
    case "cta-url":    return introCtaUrl(tl, scene.el, scene.spec, t, dur);
    case "hook":       return introHeroText(tl, scene.el, scene.spec, t, dur);
    case "stats":      return introStatsGrid(tl, scene.el, scene.spec, t, dur);
    case "detail":     return introDetail(tl, scene.el, scene.spec, t, dur);
    case "impact":     return introImpact(tl, scene.el, scene.spec, t, dur);
    case "cta":        return introCtaLegacy(tl, scene.el, scene.spec, t, dur);
    default:           return tl.fromTo(scene.el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur }, t);
  }
}

function phaseHold(tl, scene, t, dur) {
  switch (scene.type) {
    case "hero-text":
    case "hook":       return holdHeroText(tl, scene.el, scene.spec, t, dur);
    case "stats-grid":
    case "stats":      return holdStatsGrid(tl, scene.el, scene.spec, t, dur);
    case "terminal":   return holdTerminal(tl, scene.el, scene.spec, t, dur);
    case "code-diff":  return holdCodeDiff(tl, scene.el, scene.spec, t, dur);
    case "quote":      return holdQuote(tl, scene.el, scene.spec, t, dur);
    case "cta-url":
    case "cta":        return holdCta(tl, scene.el, scene.spec, t, dur);
    case "detail":     return holdDetail(tl, scene.el, scene.spec, t, dur);
    case "impact":     return holdImpact(tl, scene.el, scene.spec, t, dur);
    default:           break;
  }
}

function phaseOutro(tl, scene, t, dur) {
  // All scenes share the same outro: blur-fade-up
  tl.to(scene.el, {
    opacity: 0,
    y: -14,
    filter: "blur(3px)",
    duration: dur,
    ease: "power2.in",
  }, t);
}

// ─── INTRO implementations ────────────────────────────────────────────────────

function introHeroText(tl, el, spec, t, dur) {
  const emojiEl  = el.querySelector(".hero-emoji");
  const words    = el.querySelectorAll(".hero-word");
  const subEl    = el.querySelector(".hero-sub");
  const accentEl = el.querySelector(".hero-accent-bar");

  tl.to(el, { opacity: 1, duration: dur * 0.5, ease: "power2.out" }, t);

  if (emojiEl) {
    tl.fromTo(emojiEl,
      { opacity: 0, scale: 0.3, y: 24 },
      { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2.5)" },
      t);
  }
  if (words.length) {
    tl.fromTo(words,
      { opacity: 0, y: 44, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1,
        duration: dur * 0.7,
        stagger: { each: 0.07, from: "start" },
        ease: "power3.out" },
      t + 0.1);
  }
  if (accentEl) {
    tl.fromTo(accentEl,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.6, ease: "power4.out" },
      t + 0.25);
  }
  if (subEl) {
    tl.fromTo(subEl,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" },
      t + 0.45);
  }
}

function introStatsGrid(tl, el, spec, t, dur) {
  const eyebrow = el.querySelector(".stats-eyebrow");
  const cards   = el.querySelectorAll(".stat-card");

  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (eyebrow) {
    tl.fromTo(eyebrow,
      { opacity: 0, x: -14 },
      { opacity: 1, x: 0, duration: 0.38, ease: "power2.out" },
      t + 0.05);
  }
  if (cards.length) {
    tl.fromTo(cards,
      { opacity: 0, y: 30, scale: 0.88 },
      { opacity: 1, y: 0, scale: 1,
        duration: 0.55,
        stagger: { each: 0.1, from: "start" },
        ease: "back.out(1.8)" },
      t + 0.18);
  }
}

function introTerminal(tl, el, spec, t, dur) {
  const win      = el.querySelector(".term-window");
  const titleBar = el.querySelector(".term-titlebar");
  const lines    = el.querySelectorAll(".term-line");

  tl.fromTo(win,
    { opacity: 0, scale: 0.94, y: 28 },
    { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out" },
    t);
  if (titleBar) {
    tl.fromTo(titleBar,
      { opacity: 0 },
      { opacity: 1, duration: 0.28 },
      t + 0.12);
  }
  // Lines will be type-in driven in holdTerminal — start them all hidden
  if (lines.length) {
    tl.set(lines, { opacity: 0, x: 0 }, t);
  }
}

function introCodeDiff(tl, el, spec, t, dur) {
  const bad  = el.querySelector(".diff-panel.bad");
  const good = el.querySelector(".diff-panel.good");
  tl.to(el, { opacity: 1, duration: 0.3 }, t);
  if (bad)  tl.fromTo(bad,  { opacity: 0, x: -44 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, t + 0.1);
  if (good) tl.fromTo(good, { opacity: 0, x:  44 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, t + 0.28);
}

function introQuote(tl, el, spec, t, dur) {
  const mark   = el.querySelector(".quote-mark");
  const text   = el.querySelector(".quote-text");
  const source = el.querySelector(".quote-source");

  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (mark) {
    tl.fromTo(mark,
      { opacity: 0, scale: 3, y: -10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out" },
      t + 0.06);
  }
  if (text) {
    // Split into words for stagger
    const words = text.querySelectorAll(".quote-word");
    if (words.length) {
      tl.fromTo(words,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" },
        t + 0.2);
    } else {
      tl.fromTo(text,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
        t + 0.18);
    }
  }
  if (source) {
    tl.fromTo(source,
      { opacity: 0, x: 18 },
      { opacity: 1, x: 0, duration: 0.38, ease: "power2.out" },
      t + 0.48);
  }
}

function introCtaUrl(tl, el, spec, t, dur) {
  const labelEl  = el.querySelector(".cta-url-label");
  const urlEl    = el.querySelector(".cta-url-href");
  const subEl    = el.querySelector(".cta-url-sub");
  const badgeEl  = el.querySelector(".cta-urgency-badge");

  tl.to(el, { opacity: 1, duration: 0.35, ease: "power2.out" }, t);
  if (labelEl) {
    tl.fromTo(labelEl,
      { opacity: 0, scale: 0.82, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(2.2)" },
      t + 0.08);
  }
  if (urlEl) {
    tl.fromTo(urlEl,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" },
      t + 0.32);
  }
  if (subEl) {
    tl.fromTo(subEl,
      { opacity: 0 },
      { opacity: 1, duration: 0.35 },
      t + 0.52);
  }
  if (badgeEl) {
    tl.fromTo(badgeEl,
      { opacity: 0, scale: 0 },
      { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(3)" },
      t + 0.65);
  }
}

function introDetail(tl, el, spec, t, dur) {
  const tag     = el.querySelector(".detail-tag");
  const body    = el.querySelector(".detail-body");
  const divider = el.querySelector(".detail-divider");
  tl.to(el, { opacity: 1, duration: dur * 0.5 }, t);
  if (tag)     tl.fromTo(tag,     { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, t + 0.08);
  if (body)    tl.fromTo(body,    { opacity: 0, y: 18  }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, t + 0.22);
  if (divider) tl.fromTo(divider, { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.6, ease: "power4.out" }, t + 0.38);
}

function introImpact(tl, el, spec, t, dur) {
  const bar  = el.querySelector(".impact-visual");
  const text = el.querySelector(".impact-text");
  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (bar)  tl.fromTo(bar,  { height: 0 }, { height: "52px", duration: 0.42, ease: "power4.out" }, t + 0.06);
  if (text) tl.fromTo(text, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, t + 0.22);
}

function introCtaLegacy(tl, el, spec, t, dur) {
  const eyebrow  = el.querySelector(".cta-eyebrow");
  const main     = el.querySelector(".cta-main");
  const deadline = el.querySelector(".cta-deadline");
  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (eyebrow)  tl.fromTo(eyebrow,  { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.05);
  if (main)     tl.fromTo(main,     { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.15);
  if (deadline) tl.fromTo(deadline, { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, t + 0.32);
}

// ─── HOLD implementations — the heart of the rewrite ─────────────────────────
//
// Rules:
//  1. Every hold adds ≥1 looping tween (repeat:-1 yoyo:true)
//  2. No two consecutive scenes share the same primary hold effect
//  3. Tweens are positioned at `t` (hold phase start) so they begin right
//     after intro finishes — they run until outro kills the element

function holdHeroText(tl, el, spec, t, dur) {
  const emojiEl  = el.querySelector(".hero-emoji");
  const accentEl = el.querySelector(".hero-accent-bar");
  const words    = el.querySelectorAll(".hero-word");

  // Float emoji
  if (emojiEl) {
    tl.to(emojiEl, {
      y: -7, duration: 1.8,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }

  // Accent bar opacity breathe
  if (accentEl) {
    tl.to(accentEl, {
      opacity: 0.55, duration: 2.0,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.3);
  }

  // Subtle text glow pulse on first word (accent)
  const firstWord = words[0];
  if (firstWord && spec.accent) {
    tl.to(firstWord, {
      textShadow: "0 0 28px rgba(245,158,11,0.8)",
      duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }
}

function holdStatsGrid(tl, el, spec, t, dur) {
  const cards       = el.querySelectorAll(".stat-card");
  const accentCard  = el.querySelector(".stat-card--accent");
  const counterEls  = el.querySelectorAll("[data-counter-target]");

  // Counter-up animation: each element with data-counter-target counts up
  counterEls.forEach((el) => {
    const target = parseFloat(el.dataset.counterTarget);
    if (isNaN(target)) return;
    const obj = { val: 0 };
    const suffix = el.dataset.counterSuffix ?? "";
    const prefix = el.dataset.counterPrefix ?? "";
    tl.to(obj, {
      val: target,
      duration: Math.min(dur * 0.55, 1.8),
      ease: "power2.out",
      onUpdate() {
        // Format: if integer, show integer; else 1 decimal
        const v = Number.isInteger(target)
          ? Math.round(obj.val)
          : obj.val.toFixed(1);
        el.textContent = prefix + v.toLocaleString() + suffix;
      },
    }, t);
  });

  // Accent card border glow pulse
  if (accentCard) {
    tl.to(accentCard, {
      boxShadow: "0 0 0 1.5px rgba(245,158,11,0.8), 0 0 24px rgba(245,158,11,0.25)",
      duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.4);
  }

  // Subtle card float stagger (different card than accent for variety)
  const floatCard = cards[cards.length > 2 ? 2 : 0];
  if (floatCard && floatCard !== accentCard) {
    tl.to(floatCard, {
      y: -5, duration: 2.4,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.8);
  }
}

function holdTerminal(tl, el, spec, t, dur) {
  const lines   = el.querySelectorAll(".term-line");
  const body    = el.querySelector(".term-body");

  if (!lines.length) return;

  // True sequential type-in: each line appears one by one with delay
  // We spread them across ~80% of hold duration, then cursor blinks at end
  const budget      = dur * 0.80;
  const perLine     = budget / lines.length;

  lines.forEach((line, i) => {
    const lineAt = t + i * perLine;

    // Line appears
    tl.to(line, { opacity: 1, x: 0, duration: 0.18, ease: "power2.out" }, lineAt);

    // For prompt lines: character-by-character type effect via clip-path width
    const textEl = line.querySelector(".term-text");
    if (textEl && line.classList.contains("term-prompt")) {
      const originalText = textEl.textContent;
      const charCount = originalText.length;
      if (charCount > 0) {
        // Drive a counter that slices text
        const obj = { idx: 0 };
        tl.to(obj, {
          idx: charCount,
          duration: Math.min(perLine * 0.75, 0.9),
          ease: "steps(" + charCount + ")",
          onUpdate() {
            textEl.textContent = originalText.slice(0, Math.round(obj.idx));
          },
          onComplete() {
            textEl.textContent = originalText;
          },
        }, lineAt + 0.04);
      }
    }

    // Error lines flash red after appearing
    if (line.classList.contains("term-error")) {
      tl.to(line, {
        backgroundColor: "rgba(248,81,73,0.12)",
        duration: 0.22, ease: "power2.out",
        repeat: 3, yoyo: true,
      }, lineAt + 0.25);
    }
  });

  // Cursor blink after last line is done
  const cursorEl = el.querySelector(".term-cursor");
  if (cursorEl) {
    const cursorAt = t + lines.length * perLine;
    tl.set(cursorEl, { opacity: 1 }, cursorAt);
    tl.to(cursorEl, {
      opacity: 0, duration: 0.5,
      ease: "steps(1)", repeat: -1, yoyo: true,
    }, cursorAt + 0.1);
  }

  // Scanline drift across terminal body — CRT effect
  const scanEl = el.querySelector(".term-scanline");
  if (scanEl) {
    tl.set(scanEl, { opacity: 1, y: 0 }, t);
    tl.to(scanEl, {
      y: "100%", duration: 7,
      ease: "linear", repeat: -1,
    }, t);
  }
}

function holdCodeDiff(tl, el, spec, t, dur) {
  const bad  = el.querySelector(".diff-panel.bad");
  const good = el.querySelector(".diff-panel.good");

  // Bad panel subtle red pulse
  if (bad) {
    tl.to(bad, {
      boxShadow: "0 0 0 1px rgba(248,81,73,0.6)",
      duration: 1.4, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.3);
  }

  // Good panel subtle green breathe
  if (good) {
    tl.to(good, {
      boxShadow: "0 0 0 1px rgba(63,185,80,0.6), 0 0 18px rgba(63,185,80,0.15)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.7);
  }
}

function holdQuote(tl, el, spec, t, dur) {
  const mark   = el.querySelector(".quote-mark");
  const text   = el.querySelector(".quote-text");
  const source = el.querySelector(".quote-source");

  // Quote mark ambient glow
  if (mark) {
    tl.to(mark, {
      opacity: 0.35, scale: 1.04,
      duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.2);
  }

  // Text breathe (very subtle scale)
  if (text) {
    tl.to(text, {
      scale: 1.008,
      duration: 3.2, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.5);
  }

  // Source line shimmer
  if (source) {
    tl.to(source, {
      opacity: 0.6,
      duration: 2.0, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1.0);
  }
}

function holdCta(tl, el, spec, t, dur) {
  const labelEl = el.querySelector(".cta-url-label") ?? el.querySelector(".cta-main");
  const urlEl   = el.querySelector(".cta-url-href");
  const badgeEl = el.querySelector(".cta-urgency-badge");

  // Label text glow pulse
  if (labelEl) {
    tl.to(labelEl, {
      textShadow: "0 0 32px rgba(255,255,255,0.35)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.2);
  }

  // URL box border cycle: amber → red → amber
  if (urlEl) {
    tl.to(urlEl, {
      borderColor: "rgba(230,48,48,0.7)",
      boxShadow: "0 0 18px rgba(88,166,255,0.5)",
      duration: 1.5, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.4);
  }

  // Urgency badge bounce
  if (badgeEl) {
    tl.to(badgeEl, {
      scale: 1.07,
      duration: 1.3, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }

  // Vignette pulse on the stage itself
  const vignette = document.querySelector(".cinema-vignette");
  if (vignette) {
    tl.to(vignette, {
      opacity: 0.7,
      duration: 2.0, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }
}

function holdDetail(tl, el, spec, t, dur) {
  const tag  = el.querySelector(".detail-tag");
  const body = el.querySelector(".detail-body");

  if (tag) {
    tl.to(tag, {
      borderColor: "rgba(230,48,48,0.6)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.3);
  }
  if (body) {
    tl.to(body, {
      opacity: 0.88,
      duration: 2.5, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.5);
  }
}

function holdImpact(tl, el, spec, t, dur) {
  const bar  = el.querySelector(".impact-visual");
  const text = el.querySelector(".impact-text");

  if (bar) {
    tl.to(bar, {
      boxShadow: "0 0 18px rgba(230,48,48,0.6)",
      duration: 1.5, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.2);
  }
  if (text) {
    tl.to(text, {
      opacity: 0.82,
      duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }
}

// ─── Scene builders (DOM) ─────────────────────────────────────────────────────

function createScene(spec, idx, type) {
  const el = document.createElement("section");
  el.className = "scene";
  el.dataset.sceneId = String(spec.id ?? idx);
  el.dataset.type = type;
  switch (type) {
    case "hero-text":  buildHeroText(el, spec);       break;
    case "stats-grid": buildStatsGrid(el, spec);      break;
    case "terminal":   buildTerminal(el, spec);       break;
    case "code-diff":  buildCodeDiff(el, spec);       break;
    case "quote":      buildQuote(el, spec);          break;
    case "cta-url":    buildCtaUrl(el, spec);         break;
    case "hook":       buildHookLegacy(el, spec);     break;
    case "stats":      buildStatsLegacy(el, spec);    break;
    case "detail":     buildDetailLegacy(el, spec);   break;
    case "impact":     buildImpactLegacy(el, spec);   break;
    case "cta":        buildCtaLegacy(el, spec);      break;
    default:           buildFallbackScene(el, spec);
  }
  return el;
}

function buildHeroText(el, spec) {
  if (spec.emoji) {
    const e = dom("div", "hero-emoji");
    e.textContent = spec.emoji;
    el.appendChild(e);
  }
  const headline = spec.headline ?? spec.text ?? "";
  const h = dom("h1", "hero-headline" + (spec.accent ? " hero-headline--accent" : ""));
  headline.split(/\s+/).forEach((word, i, arr) => {
    const s = dom("span", "hero-word");
    s.textContent = word + (i < arr.length - 1 ? " " : "");
    h.appendChild(s);
  });
  el.appendChild(h);
  el.appendChild(dom("div", "hero-accent-bar"));
  if (spec.sub) el.appendChild(dom("p", "hero-sub", spec.sub));
}

function buildStatsGrid(el, spec) {
  el.appendChild(dom("div", "stats-eyebrow", "SỐ LIỆU THEN CHỐT"));
  const grid = dom("div", "stats-grid");
  const items = spec.stats
    ?? extractStatPairs(spec.text ?? "").slice(0, 4).map(p => ({ big: p.value, label: p.context }));

  items.forEach(s => {
    const card = dom("div", "stat-card" + (s.accent ? " stat-card--accent" : ""));

    const valEl = dom("div", "stat-value");

    // Detect counter-animatable values: pure number possibly with suffix like k/M/%
    const numMatch = (s.big ?? "").match(/^([0-9][0-9,.]*)([kMB%]?)$/i);
    if (numMatch && s.counter_animate !== false) {
      // Strip commas to parse
      const rawNum = parseFloat(numMatch[1].replace(/,/g, ""));
      const suffix = numMatch[2];
      const multiplier = suffix === "k" ? 1000 : suffix === "M" ? 1000000 : 1;
      const displaySuffix = suffix && multiplier === 1 ? suffix : "";

      if (!isNaN(rawNum)) {
        valEl.textContent = "0" + displaySuffix;
        valEl.dataset.counterTarget = rawNum;
        valEl.dataset.counterSuffix = displaySuffix;
      } else {
        valEl.textContent = s.big ?? "";
      }
    } else {
      valEl.textContent = s.big ?? "";
    }

    card.appendChild(valEl);
    card.appendChild(dom("div", "stat-label", s.label ?? ""));
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function buildTerminal(el, spec) {
  const win = dom("div", "term-window");

  // Title bar
  const tb   = dom("div", "term-titlebar");
  const dots = dom("div", "term-dots");
  ["red", "yellow", "green"].forEach(c => dots.appendChild(dom("span", "term-dot " + c)));
  tb.appendChild(dots);
  // Custom shell prompt label in title
  const promptLabel = spec.shell_prompt ?? "bash";
  tb.appendChild(dom("span", "term-title", (spec.title ?? "terminal") + "  —  " + promptLabel));
  win.appendChild(tb);

  // Body with lines
  const body = dom("div", "term-body");
  const linesData = spec.lines ?? [{ type: "output", text: spec.text ?? "" }];

  linesData.forEach(line => {
    const row = dom("div", "term-line term-" + (line.type ?? "output"));
    if (line.type === "prompt") {
      row.appendChild(dom("span", "term-ps", (spec.shell_prompt ?? "$") + " "));
    } else if (line.type === "error") {
      row.appendChild(dom("span", "term-ps term-ps--error", "✗ "));
    } else if (line.type === "success") {
      row.appendChild(dom("span", "term-ps term-ps--success", "✓ "));
    } else if (line.type === "warning") {
      row.appendChild(dom("span", "term-ps term-ps--warning", "⚠ "));
    }
    const t = dom("span", "term-text");
    t.textContent = line.text ?? "";
    row.appendChild(t);
    body.appendChild(row);
  });

  // Cursor element (shown after all lines are typed)
  const cursor = dom("span", "term-cursor", "█");
  body.appendChild(cursor);

  // Scanline overlay (CSS-positioned, animated in holdTerminal)
  const scanline = dom("div", "term-scanline");
  win.appendChild(body);
  win.appendChild(scanline);
  el.appendChild(win);
}

function buildCodeDiff(el, spec) {
  const wrap = dom("div", "diff-wrap");
  const mk = (cls, label, code) => {
    const p   = dom("div", "diff-panel " + cls);
    p.appendChild(dom("div", "diff-label", label ?? ""));
    const pre = dom("pre", "diff-code");
    const c   = dom("code", "");
    c.textContent = code ?? "";
    pre.appendChild(c);
    p.appendChild(pre);
    return p;
  };
  wrap.appendChild(mk("bad",  spec.badLabel  ?? "✗ before", spec.bad  ?? ""));
  wrap.appendChild(mk("good", spec.goodLabel ?? "✓ after",  spec.good ?? ""));
  el.appendChild(wrap);
}

function buildQuote(el, spec) {
  el.appendChild(dom("div", "quote-mark", "\u201C"));

  // Wrap quote words in spans for word-stagger intro
  const textEl = dom("p", "quote-text");
  const rawText = spec.text ?? "";
  rawText.split(/\s+/).forEach((word, i, arr) => {
    const s = dom("span", "quote-word");
    s.textContent = word + (i < arr.length - 1 ? " " : "");
    textEl.appendChild(s);
  });
  el.appendChild(textEl);

  if (spec.attr) {
    const s = dom("div", "quote-source");
    s.appendChild(dom("div", "quote-source-line"));
    s.appendChild(dom("span", "quote-source-text", (spec.attr ?? "").toUpperCase()));
    el.appendChild(s);
  }
}

function buildCtaUrl(el, spec) {
  // Urgency badge
  if (spec.urgency_badge) {
    el.appendChild(dom("div", "cta-urgency-badge", spec.urgency_badge));
  }
  el.appendChild(dom("div", "cta-url-label", spec.label ?? ""));
  if (spec.url) {
    const u = dom("div", "cta-url-href");
    u.appendChild(dom("span", "cta-url-icon", "🔗 "));
    u.appendChild(txt(spec.url));
    el.appendChild(u);
  }
  if (spec.sub) el.appendChild(dom("p", "cta-url-sub", spec.sub));
}

// ── Legacy builders (unchanged logic, preserved for backward compat) ──

function buildHookLegacy(el, spec) {
  el.appendChild(dom("div", "hook-label", "● BREAKING NEWS"));
  const h  = dom("h1", "hook-headline");
  const em = (spec.text ?? "").match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Extended_Pictographic})/u);
  const emoji = em ? em[0] : "";
  if (emoji) { const s = dom("span", "hook-emoji"); s.textContent = emoji + " "; h.appendChild(s); }
  h.appendChild(txt((spec.text ?? "").slice(emoji.length).trim()));
  el.appendChild(h);
  el.appendChild(dom("div", "hook-line"));
}

function buildStatsLegacy(el, spec) {
  el.appendChild(dom("div", "stats-eyebrow", "SỐ LIỆU THEN CHỐT"));
  const grid = dom("div", "stats-grid");
  extractStatPairs(spec.text ?? "").slice(0, 4).forEach(({ value, context }) => {
    const card = dom("div", "stat-card");
    card.appendChild(dom("div", "stat-value", value));
    card.appendChild(dom("div", "stat-label", context));
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function buildDetailLegacy(el, spec) {
  const tag = dom("div", "detail-tag");
  const dot = dom("span", "detail-tag-dot");
  tag.appendChild(dot);
  tag.appendChild(txt(" CHI TIẾT"));
  el.appendChild(tag);
  const body = dom("p", "detail-body");
  body.innerHTML = highlightCode(escapeHtml(spec.text ?? ""));
  el.appendChild(body);
  el.appendChild(dom("div", "detail-divider"));
}

function buildImpactLegacy(el, spec) {
  el.appendChild(dom("div", "impact-visual"));
  const text = dom("p", "impact-text");
  text.innerHTML = highlightNumbers(escapeHtml(spec.text ?? ""));
  el.appendChild(text);
}

function buildCtaLegacy(el, spec) {
  el.appendChild(dom("div", "cta-eyebrow", "HÀNH ĐỘNG NGAY"));
  const main = dom("p", "cta-main");
  main.textContent = spec.text ?? "";
  el.appendChild(main);
}

function buildFallbackScene(el, spec) {
  const t = dom("h1", "scene-title");
  t.textContent = spec.text ?? "";
  el.appendChild(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dom(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function txt(s) { return document.createTextNode(s); }
function escapeHtml(s) {
  return s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}
function highlightCode(html) {
  return html.replace(CODE_TOKEN_RE, '<span class="detail-code">$1</span>');
}
function highlightNumbers(html) {
  return html.replace(
    /(\d[\d.,]*\s*(?:triệu|tỷ|nghìn|k|M|B|%|USD|người)?)/gi,
    "<em>$1</em>"
  );
}
function extractStatPairs(text) {
  const results = [];
  const re = /([0-9][\d.,]*(?:\s*(?:triệu|tỷ|nghìn|k|M|B|%|USD))?)\s+(.{4,40}?)(?=[,;]|$)/gi;
  let match;
  while ((match = re.exec(text)) !== null && results.length < 4) {
    results.push({ value: match[1].trim(), context: match[2].trim().replace(/,$/, "") });
  }
  return results;
}