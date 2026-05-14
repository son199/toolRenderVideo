/**
 * Promo template — Animation Engine v3 (Cinematic 3-Phase)
 *
 * Architecture (mirror news v4):
 *   Every scene runs through 3 phases on the master timeline:
 *     [intro]  elements enter      (stagger / pop-in / slide-in)
 *     [hold]   living loops        (breathe, glow pulse, drift)
 *     [outro]  shared blur-fade-up (consistent across all types)
 *
 * Scene types supported:
 *   hero-text | product-card | feature-grid | quote | cta-url
 *   + legacy roles: hook | problem | product | features | cta
 *   + alias: stats-grid → feature-grid builder (LLM freelance safety)
 *
 * Cinematic layer:
 *   - Slow push-in on hero/product-card/quote scenes (product slightly stronger)
 *   - Pull-out on final CTA scene
 *   - lightFlash transitions between cuts (skip scene 0)
 *   - Ambient float on teal + amber chromatic glow blobs
 */

import {
  installCinematicTickerHints,
  pushIn,
  pullOut,
  ambientFloat,
  lightFlash,
} from "../../shared/cinematic.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGACY_ROLES = ["hook", "problem", "product", "features", "cta"];
const SCENES_WITH_PUSHIN  = new Set(["hero-text", "hook", "problem", "product-card", "product", "quote"]);
const SCENES_WITH_PULLOUT = new Set(["cta-url", "cta"]);

const INTRO_FRAC = 0.28;
const INTRO_CAP  = 1.4;   // intro never longer than this
const OUTRO_DUR  = 0.32;  // fixed outro

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildTimeline(storyboard, audioMeta) {
  installCinematicTickerHints();

  const container = document.getElementById("scenes");
  container.innerHTML = "";

  const scenes = storyboard.scenes.map((spec, idx) => {
    const duration = audioMeta?.[idx]?.duration_sec ?? spec.duration_sec ?? 4;
    const type = resolveType(spec, idx, storyboard.scenes.length);
    const el = createScene(spec, idx, type);
    container.appendChild(el);
    return { spec, el, duration, type };
  });

  const tl = window.gsap.timeline({ paused: false });
  const subtitleEl = document.getElementById("subtitle-text");
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);

  // ── Ambient cinematic layer: teal + amber chromatic glow blobs ──
  const blobTeal  = document.getElementById("glow-blob-teal");
  const blobAmber = document.getElementById("glow-blob-amber");
  if (blobTeal)  ambientFloat(tl, blobTeal,  totalDur, { intensity: 10, periodSec: 14 });
  if (blobAmber) ambientFloat(tl, blobAmber, totalDur, { intensity: 8,  periodSec: 11 });

  // ── Scene loop ──
  let cursor = 0;

  scenes.forEach((scene, i) => {
    const introDur  = Math.min(scene.duration * INTRO_FRAC, INTRO_CAP);
    const outroDur  = OUTRO_DUR;
    const holdDur   = Math.max(scene.duration - introDur - outroDur, 0.4);
    const holdStart = cursor + introDur;
    const outroAt   = holdStart + holdDur;

    // Flash cut between scenes (skip scene 0)
    if (i > 0) lightFlash(tl, cursor - 0.08, 0.16, 0.4);

    tl.set(scene.el, { visibility: "visible" }, cursor);

    // Phase 1 — Intro
    phaseIntro(tl, scene, cursor, introDur);

    // Cinematic camera move layered on top
    if (SCENES_WITH_PUSHIN.has(scene.type)) {
      const isProduct = scene.type === "product-card" || scene.type === "product";
      pushIn(tl, scene.el, cursor, scene.duration, 1, isProduct ? 1.08 : 1.05);
    } else if (SCENES_WITH_PULLOUT.has(scene.type)) {
      pullOut(tl, scene.el, cursor, scene.duration, 1.05, 1);
    }

    // Phase 2 — Hold (living loops)
    phaseHold(tl, scene, holdStart, holdDur);

    // Phase 3 — Outro (shared blur-fade-up)
    phaseOutro(tl, scene, outroAt, outroDur);
    tl.set(scene.el, { visibility: "hidden", y: 0, filter: "none" }, outroAt + outroDur);

    // Subtitle band = SHORT English supplement; body already carries caption.vi
    const captionText =
      scene.spec.caption?.en ??
      scene.spec.caption?.vi ?? "";

    tl.call(() => {
      subtitleEl.textContent = captionText;
      subtitleEl.style.opacity = "1";
    }, null, cursor + 0.15);

    tl.call(() => { subtitleEl.style.opacity = "0"; }, null, outroAt + outroDur - 0.05);

    cursor += scene.duration;
  });

  return tl;
}

function resolveType(spec, idx, total) {
  if (spec.type) return spec.type;
  return LEGACY_ROLES[Math.min(idx, LEGACY_ROLES.length - 1)] ?? "hero-text";
}

// ─── Phase routers ────────────────────────────────────────────────────────────

function phaseIntro(tl, scene, t, dur) {
  switch (scene.type) {
    case "hero-text":
    case "hook":
    case "problem":      return introHeroText(tl, scene.el, scene.spec, t, dur);
    case "product-card":
    case "product":      return introProductCard(tl, scene.el, scene.spec, t, dur);
    case "feature-grid":
    case "stats-grid":
    case "features":     return introFeatureGrid(tl, scene.el, scene.spec, t, dur);
    case "quote":        return introQuote(tl, scene.el, scene.spec, t, dur);
    case "cta-url":
    case "cta":          return introCtaUrl(tl, scene.el, scene.spec, t, dur);
    default:             return introFallback(tl, scene.el, t, dur);
  }
}

function phaseHold(tl, scene, t, dur) {
  switch (scene.type) {
    case "hero-text":
    case "hook":
    case "problem":      return holdHeroText(tl, scene.el, scene.spec, t, dur);
    case "product-card":
    case "product":      return holdProductCard(tl, scene.el, scene.spec, t, dur);
    case "feature-grid":
    case "stats-grid":
    case "features":     return holdFeatureGrid(tl, scene.el, scene.spec, t, dur);
    case "quote":        return holdQuote(tl, scene.el, scene.spec, t, dur);
    case "cta-url":
    case "cta":          return holdCtaUrl(tl, scene.el, scene.spec, t, dur);
    default:             break;
  }
}

function phaseOutro(tl, scene, t, dur) {
  // Shared outro across all types: blur-fade-up
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
  const emojiEl = el.querySelector(".hero-emoji");
  const words   = el.querySelectorAll(".hero-word");
  const subEl   = el.querySelector(".hero-sub");

  tl.to(el, { opacity: 1, duration: dur * 0.5, ease: "power2.out" }, t);
  if (emojiEl) {
    tl.fromTo(emojiEl,
      { opacity: 0, scale: 0.4, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(2)" }, t);
  }
  if (words.length) {
    tl.fromTo(words,
      { opacity: 0, y: 40, scale: 0.88 },
      { opacity: 1, y: 0, scale: 1, duration: dur * 0.65,
        stagger: { each: 0.06, from: "start" }, ease: "power3.out" },
      t + 0.1);
  }
  if (subEl) {
    tl.fromTo(subEl, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.4);
  }
}

function introProductCard(tl, el, spec, t, dur) {
  const card    = el.querySelector(".product-card");
  const nameEl  = el.querySelector(".product-name");
  const tagEl   = el.querySelector(".product-tagline");
  const badgeEl = el.querySelector(".product-badge");
  const subEl   = el.querySelector(".product-subtext");

  tl.to(el, { opacity: 1, duration: 0.35 }, t);
  if (card) {
    tl.fromTo(card,
      { opacity: 0, scale: 0.85, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" }, t);
  }
  if (nameEl) {
    tl.fromTo(nameEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, t + 0.15);
  }
  if (tagEl) {
    tl.fromTo(tagEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.3);
  }
  if (badgeEl) {
    tl.fromTo(badgeEl,
      { opacity: 0, scale: 0, rotation: -15 },
      { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2.2)" }, t + 0.45);
  }
  if (subEl) {
    tl.fromTo(subEl, { opacity: 0 }, { opacity: 0.85, duration: 0.4 }, t + 0.55);
  }
}

function introFeatureGrid(tl, el, spec, t, dur) {
  const eyebrow = el.querySelector(".features-eyebrow");
  const items   = el.querySelectorAll(".feature-item");

  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (eyebrow) {
    tl.fromTo(eyebrow, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" }, t + 0.05);
  }
  if (items.length) {
    tl.fromTo(items,
      { opacity: 0, x: -30, scale: 0.92 },
      { opacity: 1, x: 0, scale: 1, duration: 0.5,
        stagger: { each: 0.12, from: "start" }, ease: "power3.out" },
      t + 0.18);
  }
}

function introQuote(tl, el, spec, t, dur) {
  const mark   = el.querySelector(".quote-mark");
  const text   = el.querySelector(".quote-text");
  const source = el.querySelector(".quote-source");

  tl.to(el, { opacity: 1, duration: dur * 0.4 }, t);
  if (mark) {
    tl.fromTo(mark,
      { opacity: 0, y: 10, scale: 0.7 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(2)" }, t + 0.06);
  }
  if (text) {
    tl.fromTo(text,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, t + 0.18);
  }
  if (source) {
    tl.fromTo(source,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, t + 0.42);
  }
}

function introCtaUrl(tl, el, spec, t, dur) {
  const labelEl = el.querySelector(".cta-url-label");
  const urlEl   = el.querySelector(".cta-url-href");
  const subEl   = el.querySelector(".cta-url-sub");

  tl.to(el, { opacity: 1, duration: 0.35 }, t);
  if (labelEl) {
    tl.fromTo(labelEl,
      { opacity: 0, scale: 0.85, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2)" }, t + 0.08);
  }
  if (urlEl) {
    tl.fromTo(urlEl,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.32);
  }
  if (subEl) {
    tl.fromTo(subEl, { opacity: 0 }, { opacity: 0.9, duration: 0.4 }, t + 0.55);
  }
}

function introFallback(tl, el, t, dur) {
  tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur * 0.5, ease: "power2.out" }, t);
}

// ─── HOLD implementations — the heart of the rewrite ─────────────────────────
//
// Rules:
//  1. Every hold adds ≥1 looping tween (repeat:-1 yoyo:true)
//  2. No two consecutive scenes share the same primary hold effect
//  3. Tweens positioned at `t` (hold phase start) — run until outro kills element

function holdHeroText(tl, el, spec, t, dur) {
  const emojiEl = el.querySelector(".hero-emoji");
  const subEl   = el.querySelector(".hero-sub");
  const words   = el.querySelectorAll(".hero-word");

  // Float emoji
  if (emojiEl) {
    tl.to(emojiEl, {
      y: -7, duration: 1.8,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }

  // Accent word glow pulse (first word when accent flag set)
  const firstWord = words[0];
  if (firstWord && spec?.accent) {
    tl.to(firstWord, {
      textShadow: "0 0 30px rgba(255,200,80,0.85)",
      duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.3);
  }

  // Sub opacity breathe
  if (subEl) {
    tl.to(subEl, {
      opacity: 0.7, duration: 2.4,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }
}

function holdProductCard(tl, el, spec, t, dur) {
  const card    = el.querySelector(".product-card");
  const nameEl  = el.querySelector(".product-name");
  const badgeEl = el.querySelector(".product-badge");

  // Card subtle scale breathe
  if (card) {
    tl.to(card, {
      scale: 1.012, duration: 2.6,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
  }

  // Product name glow pulse
  if (nameEl) {
    tl.to(nameEl, {
      textShadow: "0 0 24px rgba(255,200,80,0.6)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.3);
  }

  // Badge gentle rotation wobble
  if (badgeEl) {
    tl.to(badgeEl, {
      rotation: 3, duration: 1.4,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.5);
  }
}

function holdFeatureGrid(tl, el, spec, t, dur) {
  const items = el.querySelectorAll(".feature-item");
  const icons = el.querySelectorAll(".feature-icon");
  const eyebrow = el.querySelector(".features-eyebrow");

  // Icon stagger oscillation — different phases per icon for variety
  icons.forEach((icon, i) => {
    const delay = i * 0.18;
    const dir = i % 2 === 0 ? 1 : -1;
    tl.to(icon, {
      rotation: dir * 4, y: -3,
      duration: 1.6 + i * 0.1,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + delay);
  });

  // Highlight last feature item with border glow (anchor point)
  const last = items[items.length - 1];
  if (last) {
    tl.to(last, {
      boxShadow: "0 0 0 1px rgba(255,200,80,0.5), 0 0 18px rgba(255,200,80,0.18)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }

  // Eyebrow soft breathe
  if (eyebrow) {
    tl.to(eyebrow, {
      opacity: 0.55, duration: 2.2,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.9);
  }
}

function holdQuote(tl, el, spec, t, dur) {
  const mark   = el.querySelector(".quote-mark");
  const text   = el.querySelector(".quote-text");
  const source = el.querySelector(".quote-source");

  // Quote mark drift + opacity breathe
  if (mark) {
    tl.to(mark, {
      opacity: 0.4, scale: 1.05,
      duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.2);
  }

  // Text very subtle scale breath
  if (text) {
    tl.to(text, {
      scale: 1.008,
      duration: 3.2, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.5);
  }

  // Source shimmer
  if (source) {
    tl.to(source, {
      opacity: 0.6,
      duration: 2, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 1);
  }
}

function holdCtaUrl(tl, el, spec, t, dur) {
  const labelEl = el.querySelector(".cta-url-label");
  const urlEl   = el.querySelector(".cta-url-href");
  const subEl   = el.querySelector(".cta-url-sub");

  // Label text shadow breathe
  if (labelEl) {
    tl.to(labelEl, {
      textShadow: "0 0 30px rgba(255,255,255,0.35)",
      duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.1);
  }

  // URL glow pulse — strong amber yoyo (signature CTA effect)
  if (urlEl) {
    tl.fromTo(urlEl,
      { boxShadow: "0 0 24px rgba(255,200,80,0.45)" },
      { boxShadow: "0 0 56px rgba(255,200,80,0.95)",
        duration: 0.9, ease: "sine.inOut", repeat: -1, yoyo: true },
      t + 0.2);
  }

  // Sub breath
  if (subEl) {
    tl.to(subEl, {
      opacity: 0.65, duration: 2.4,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t + 0.6);
  }

  // Vignette pulse on stage
  const vignette = document.querySelector(".cinema-vignette");
  if (vignette) {
    tl.to(vignette, {
      opacity: 0.7, duration: 2,
      ease: "sine.inOut", repeat: -1, yoyo: true,
    }, t);
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
    case "hero-text":
    case "hook":
    case "problem":      buildHeroText(el, spec); break;
    case "product-card":
    case "product":      buildProductCard(el, spec); break;
    case "feature-grid":
    case "stats-grid":
    case "features":     buildFeatureGrid(el, spec); break;
    case "quote":        buildQuote(el, spec); break;
    case "cta-url":
    case "cta":          buildCtaUrl(el, spec); break;
    default:             buildFallbackScene(el, spec);
  }
  return el;
}

function buildHeroText(el, spec) {
  el.classList.add("s-hero");
  if (spec.emoji) {
    const e = dom("div", "hero-emoji");
    e.textContent = spec.emoji;
    el.appendChild(e);
  }
  const headline = spec.headline ?? spec.text ?? "";
  const h = dom("h1", "hero-headline" + (spec.accent ? " hero-headline--accent" : ""));
  headline.split(/\s+/).forEach((word, i, arr) => {
    const span = dom("span", "hero-word");
    span.textContent = word + (i < arr.length - 1 ? " " : "");
    h.appendChild(span);
  });
  el.appendChild(h);
  if (spec.sub) el.appendChild(dom("p", "hero-sub", spec.sub));
}

function buildProductCard(el, spec) {
  el.classList.add("s-product");
  const card = dom("div", "product-card");
  if (spec.badge) {
    const b = dom("div", "product-badge");
    b.textContent = spec.badge;
    card.appendChild(b);
  }
  if (spec.name) card.appendChild(dom("div", "product-name", spec.name));
  if (spec.tagline) card.appendChild(dom("div", "product-tagline", spec.tagline));
  if (spec.subtext) card.appendChild(dom("div", "product-subtext", spec.subtext));
  el.appendChild(card);
}

function buildFeatureGrid(el, spec) {
  el.classList.add("s-features");
  el.appendChild(dom("div", "features-eyebrow", "TÍNH NĂNG NỔI BẬT"));
  const grid = dom("div", "feature-grid");
  let items = [];
  if (Array.isArray(spec.features) && spec.features.length) {
    items = spec.features;
  } else if (Array.isArray(spec.stats) && spec.stats.length) {
    items = spec.stats.map((s) => ({
      icon: s.icon ?? "✦",
      title: s.big ?? s.title ?? "",
      desc: s.label ?? s.desc ?? "",
    }));
  } else {
    items = extractFeaturesFromText(spec.text ?? spec.caption?.vi ?? "");
  }
  items.slice(0, 4).forEach((f) => {
    const item = dom("div", "feature-item");
    if (f.icon) item.appendChild(dom("div", "feature-icon", f.icon));
    const body = dom("div", "feature-body");
    if (f.title) body.appendChild(dom("div", "feature-title", f.title));
    if (f.desc)  body.appendChild(dom("div", "feature-desc", f.desc));
    item.appendChild(body);
    grid.appendChild(item);
  });
  el.appendChild(grid);
}

function buildQuote(el, spec) {
  el.classList.add("s-quote");
  el.appendChild(dom("div", "quote-mark", "“"));
  el.appendChild(dom("p", "quote-text", spec.text ?? ""));
  if (spec.attr) {
    const s = dom("div", "quote-source");
    s.appendChild(dom("div", "quote-source-line"));
    s.appendChild(dom("span", "quote-source-text", String(spec.attr).toUpperCase()));
    el.appendChild(s);
  }
}

function buildCtaUrl(el, spec) {
  el.classList.add("s-cta");
  el.appendChild(dom("div", "cta-url-label", spec.label ?? spec.text ?? ""));
  if (spec.url) {
    const u = dom("div", "cta-url-href");
    u.appendChild(dom("span", "cta-url-icon", "🔗 "));
    u.appendChild(txt(spec.url));
    el.appendChild(u);
  }
  if (spec.sub) el.appendChild(dom("p", "cta-url-sub", spec.sub));
}

function buildFallbackScene(el, spec) {
  const t = dom("h1", "scene-title");
  t.textContent = spec.headline ?? spec.text ?? "";
  el.appendChild(t);
  if (spec.sub) el.appendChild(dom("p", "scene-sub", spec.sub));
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

function extractFeaturesFromText(text) {
  const parts = text
    .replace(/[.!?]+$/g, "")
    .split(/,|·|\s\/\s|\s-\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, 4).map((p) => ({
    icon: "✓",
    title: p.length <= 36 ? p : p.slice(0, 33) + "…",
    desc: "",
  }));
}
