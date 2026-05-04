/**
 * Split-flap “flip tile” UI: hydrates each `.flip-tile` from a shared HTML template.
 * Flip runs in two DOM phases so the upper leaf finishes before the lower leaf runs
 * (no CSS animation-delay overlap — avoids both digits showing at once).
 * A short gap after phase 1 lets the browser paint a stable frame before phase 2.
 */

import { FLIP_INTER_PHASE_GAP_MS } from './constants.js'

const FLIP_LAYERS_TEMPLATE_ID = 'flip-tile-layers-template'

const PHASE1 = 'is-flipping-phase1'
const PHASE2 = 'is-flipping-phase2'

/**
 * @typedef {{ setValue: (next: string, animate?: boolean) => void }} FlipTileController
 */

/**
 * @param {AnimationEvent} e
 * @param {string} nameSubstring
 * @returns {boolean}
 */
function isOwnKeyframeEnd(e, nameSubstring) {
  return (
    e.target === e.currentTarget &&
    e.animationName.split(',').some((n) => n.trim().includes(nameSubstring))
  )
}

/**
 * Clone canonical flip layers from `#flip-tile-layers-template` into `tileEl`,
 * then wire flip animation state.
 * @param {HTMLElement} tileEl Root `.flip-tile` (may contain only `data-flip-initial` / legacy `.flip-tile__digits`).
 * @returns {FlipTileController}
 */
export function createFlipTile(tileEl) {
  const legacyDigits = tileEl.querySelector('.flip-tile__digits')
  const initial =
    (legacyDigits?.textContent?.trim() ||
      tileEl.dataset.flipInitial ||
      tileEl.getAttribute('data-flip-initial') ||
      '00') +
    ''

  const tpl = document.getElementById(FLIP_LAYERS_TEMPLATE_ID)
  if (!(tpl instanceof HTMLTemplateElement)) {
    console.error(`[flip-tile] Missing #${FLIP_LAYERS_TEMPLATE_ID}`)
    return makeTextOnlyFallback(tileEl, initial)
  }

  if (legacyDigits) legacyDigits.remove()
  tileEl.replaceChildren()
  tileEl.appendChild(tpl.content.cloneNode(true))

  const topStaticText = tileEl.querySelector('.flip-tile__half--top .flip-tile__text')
  const bottomStaticText = tileEl.querySelector('.flip-tile__half--bottom .flip-tile__text')
  const topFlapText = tileEl.querySelector('.flip-tile__flap--top .flip-tile__text')
  const bottomFlapText = tileEl.querySelector('.flip-tile__flap--bottom .flip-tile__text')
  const topFlap = tileEl.querySelector('.flip-tile__flap--top')
  const bottomFlap = tileEl.querySelector('.flip-tile__flap--bottom')

  if (
    !(topStaticText instanceof HTMLElement) ||
    !(bottomStaticText instanceof HTMLElement) ||
    !(topFlapText instanceof HTMLElement) ||
    !(bottomFlapText instanceof HTMLElement) ||
    !(topFlap instanceof HTMLElement) ||
    !(bottomFlap instanceof HTMLElement)
  ) {
    console.error('[flip-tile] Template structure mismatch')
    return makeTextOnlyFallback(tileEl, initial)
  }

  topStaticText.textContent = initial
  bottomStaticText.textContent = initial

  let current = initial
  let flipping = false
  let queued = ''
  let flipRafId = 0
  /** @type {number} */
  let phase2GapTimeoutId = 0
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function clearPhase2Gap() {
    if (phase2GapTimeoutId) {
      clearTimeout(phase2GapTimeoutId)
      phase2GapTimeoutId = 0
    }
  }

  function clearFlipClasses() {
    tileEl.classList.remove(PHASE1, PHASE2, 'is-flipping')
  }

  function commitStatic(next) {
    topStaticText.textContent = next
    bottomStaticText.textContent = next
    current = next
  }

  /**
   * After upper flap ends: clear phase 1, wait one frame + a short timeout so layout
   * settles, then start phase 2 (lower flap only).
   */
  function beginPhase2() {
    clearFlipClasses()
    clearPhase2Gap()
    requestAnimationFrame(() => {
      phase2GapTimeoutId = setTimeout(() => {
        phase2GapTimeoutId = 0
        if (!flipping) return
        requestAnimationFrame(() => {
          if (!flipping) return
          tileEl.classList.add(PHASE2)
        })
      }, FLIP_INTER_PHASE_GAP_MS)
    })
  }

  /** @param {AnimationEvent} e */
  function onTopAnimationEnd(e) {
    if (!flipping) return
    if (!isOwnKeyframeEnd(e, 'flip-tile-top-fold')) return
    topFlap.removeEventListener('animationend', onTopAnimationEnd)
    beginPhase2()
  }

  /** @param {AnimationEvent} e */
  function onBottomAnimationEnd(e) {
    if (!flipping) return
    if (!isOwnKeyframeEnd(e, 'flip-tile-bottom-swing')) return
    bottomFlap.removeEventListener('animationend', onBottomAnimationEnd)
    clearFlipClasses()
    flipping = false
    const next = bottomFlapText.textContent || current
    commitStatic(next)
    if (queued && queued !== current) {
      const pending = queued
      queued = ''
      runFlip(pending)
    }
  }

  function runFlip(next) {
    flipping = true
    topFlapText.textContent = current
    bottomFlapText.textContent = next
    if (flipRafId) cancelAnimationFrame(flipRafId)
    flipRafId = 0
    clearPhase2Gap()
    clearFlipClasses()
    topFlap.addEventListener('animationend', onTopAnimationEnd)
    bottomFlap.addEventListener('animationend', onBottomAnimationEnd)
    flipRafId = requestAnimationFrame(() => {
      tileEl.classList.add(PHASE1)
      flipRafId = 0
    })
  }

  return {
    /**
     * @param {string} next Two-character display (e.g. hours/minutes/seconds pair).
     * @param {boolean} [animate=true]
     */
    setValue(next, animate = true) {
      if (next === current) return
      if (!animate || reduceMotion.matches) {
        queued = ''
        if (flipRafId) {
          cancelAnimationFrame(flipRafId)
          flipRafId = 0
        }
        clearPhase2Gap()
        topFlap.removeEventListener('animationend', onTopAnimationEnd)
        bottomFlap.removeEventListener('animationend', onBottomAnimationEnd)
        clearFlipClasses()
        flipping = false
        commitStatic(next)
        return
      }
      if (flipping) {
        queued = next
        return
      }
      runFlip(next)
    },
  }
}

/**
 * @param {HTMLElement} el
 * @param {string} [initial='']
 * @returns {FlipTileController}
 */
function makeTextOnlyFallback(el, initial = '') {
  return {
    setValue(next) {
      el.textContent = next || initial
    },
  }
}
