// Shared helpers consumed by template animation.js files.
// Templates import via:  import { fillSlots, syncSubtitles } from "../../shared/gsap-helpers.js";

/**
 * Fill DOM slots based on `data-slot` attributes for a given scene element.
 * @param {HTMLElement} sceneEl
 * @param {Record<string, string>} values - slot name -> text content
 */
export function fillSlots(sceneEl, values) {
  for (const [slot, value] of Object.entries(values)) {
    const target = sceneEl.querySelector(`[data-slot="${slot}"]`);
    if (target) target.textContent = value ?? "";
  }
}

/**
 * Build a GSAP timeline that toggles `.active` on word spans according to timings.
 * Returns the timeline so the caller can nest it into the master timeline.
 *
 * @param {HTMLElement} container - element containing rendered .word spans
 * @param {Array<{word: string; start: number; end: number}>} timings
 */
export function buildWordHighlightTimeline(container, timings) {
  // Lazy import gsap from global - templates load it via CDN.
  const tl = window.gsap.timeline();
  const words = container.querySelectorAll(".word");
  timings.forEach((t, i) => {
    const el = words[i];
    if (!el) return;
    tl.call(() => el.classList.add("active"), null, t.start);
    tl.call(() => el.classList.remove("active"), null, t.end);
  });
  return tl;
}

/**
 * Render the words of a scene's narration as <span class="word"> elements
 * inside a subtitle container.
 *
 * @param {HTMLElement} container
 * @param {string} text
 */
export function renderWords(container, text) {
  container.innerHTML = "";
  const tokens = text.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = token + " ";
    container.appendChild(span);
  }
}
