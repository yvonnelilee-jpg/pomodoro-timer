/**
 * Split-flap “flip tile” UI: hydrates each `.flip-tile` from a shared HTML template
 * instead of building identical DOM in JavaScript.
 */

const FLIP_LAYERS_TEMPLATE_ID = 'flip-tile-layers-template'

/**
 * @typedef {{ setValue: (next: string, animate?: boolean) => void }} FlipTileController
 */

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
  const bottomFlap = tileEl.querySelector('.flip-tile__flap--bottom')

  if (
    !(topStaticText instanceof HTMLElement) ||
    !(bottomStaticText instanceof HTMLElement) ||
    !(topFlapText instanceof HTMLElement) ||
    !(bottomFlapText instanceof HTMLElement) ||
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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function commitStatic(next) {
    topStaticText.textContent = next
    bottomStaticText.textContent = next
    current = next
  }

  function runFlip(next) {
    flipping = true
    topFlapText.textContent = current
    bottomFlapText.textContent = next
    if (flipRafId) cancelAnimationFrame(flipRafId)
    tileEl.classList.remove('is-flipping')
    flipRafId = requestAnimationFrame(() => {
      tileEl.classList.add('is-flipping')
      flipRafId = 0
    })
  }

  bottomFlap.addEventListener('animationend', () => {
    if (!flipping) return
    tileEl.classList.remove('is-flipping')
    flipping = false
    const next = bottomFlapText.textContent || current
    commitStatic(next)
    if (queued && queued !== current) {
      const pending = queued
      queued = ''
      runFlip(pending)
    }
  })

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
        tileEl.classList.remove('is-flipping')
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
