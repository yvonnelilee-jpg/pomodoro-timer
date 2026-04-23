/**
 * Duration wheel: builds columns and option rows from `<template>` elements,
 * then attaches drag / wheel / keyboard interaction.
 */

/** @typedef {import('./constants.js').WheelColumnSpec} WheelColumnSpec */
/** @typedef {import('./constants.js').WheelKind} WheelKind */

const COLUMN_TEMPLATE_ID = 'wheel-picker-column-template'
const ROW_TEMPLATE_ID = 'wheel-picker-row-template'

/**
 * Mounts the three wheel columns inside `container` from `#wheel-picker-column-template`.
 * @param {HTMLElement} container Typically `#wheel-picker-columns`.
 * @param {readonly WheelColumnSpec[]} specs
 */
export function mountWheelPickerColumns(container, specs) {
  const tpl = document.getElementById(COLUMN_TEMPLATE_ID)
  if (!(tpl instanceof HTMLTemplateElement)) {
    console.error(`[wheel-picker] Missing #${COLUMN_TEMPLATE_ID}`)
    return
  }
  container.replaceChildren()
  for (const col of specs) {
    const frag = tpl.content.cloneNode(true)
    const viewport = frag.querySelector('[data-wheel-viewport]')
    if (!(viewport instanceof HTMLElement)) continue
    viewport.id = col.id
    viewport.setAttribute('aria-label', col.ariaLabel)
    container.appendChild(frag)
  }
}

/**
 * @param {WheelKind} kind
 * @param {number} value
 * @returns {string}
 */
function wheelOptionId(kind, value) {
  if (kind === 'hours') return `wheel-h-${value}`
  if (kind === 'minutes') return `wheel-m-${value}`
  return `wheel-s-${value}`
}

/**
 * @param {HTMLElement} track
 * @param {number} max inclusive
 * @param {WheelKind} kind
 */
export function populateWheelTrack(track, max, kind) {
  const tpl = document.getElementById(ROW_TEMPLATE_ID)
  if (!(tpl instanceof HTMLTemplateElement)) {
    console.error(`[wheel-picker] Missing #${ROW_TEMPLATE_ID}`)
    track.textContent = ''
    return
  }

  track.textContent = ''
  const unit = kind === 'hours' ? 'h' : kind === 'minutes' ? 'm' : 's'

  for (let i = 0; i <= max; i++) {
    const frag = tpl.content.cloneNode(true)
    const row = frag.querySelector('.wheel-picker__item')
    const num = frag.querySelector('.wheel-picker__num')
    const unitEl = frag.querySelector('.wheel-picker__unit')
    if (!(row instanceof HTMLElement) || !(num instanceof HTMLElement) || !(unitEl instanceof HTMLElement)) continue

    row.id = wheelOptionId(kind, i)
    row.setAttribute('role', 'option')
    row.setAttribute('aria-selected', 'false')
    row.dataset.value = String(i)
    num.textContent = String(i)
    unitEl.textContent = unit
    track.appendChild(frag)
  }
}

/**
 * @typedef {{
 *   getIndex: () => number
 *   setIndex: (i: number, animate?: boolean) => void
 *   setIndexSilent: (i: number, animate?: boolean) => void
 *   remeasure: () => void
 * }} WheelController
 */

/**
 * @param {HTMLElement} viewport
 * @param {HTMLElement} track
 * @param {number} max inclusive
 * @param {WheelKind} kind
 * @param {(index: number) => void} onCommit
 * @returns {WheelController}
 */
export function attachWheel(viewport, track, max, kind, onCommit) {
  populateWheelTrack(track, max, kind)

  let itemHeight = 44
  const first = track.querySelector('.wheel-picker__item')
  if (first) {
    const h = first.getBoundingClientRect().height
    if (h > 0) itemHeight = h
  }

  let index = 0
  let translateY = 0
  /** @type {number | null} */
  let dragPointerId = null
  let dragStartClientY = 0
  let dragStartTranslate = 0
  let isMouseDragging = false
  let isTouchDragging = false

  function tyForIndex(i) {
    const H = viewport.clientHeight
    return H / 2 - itemHeight / 2 - i * itemHeight
  }

  function indexFromTy(ty) {
    const H = viewport.clientHeight
    const raw = (H / 2 - itemHeight / 2 - ty) / itemHeight
    return Math.max(0, Math.min(max, Math.round(raw)))
  }

  function setVisualRow(i) {
    const v = Math.max(0, Math.min(max, Math.round(i)))
    viewport.setAttribute('aria-activedescendant', wheelOptionId(kind, v))
    track.querySelectorAll('.wheel-picker__item').forEach((el, j) => {
      el.setAttribute('aria-selected', j === v ? 'true' : 'false')
    })
  }

  function applyTransform(animate) {
    translateY = tyForIndex(index)
    track.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.85, 0.25, 1)' : 'none'
    track.style.transform = `translate3d(0, ${translateY}px, 0)`
    setVisualRow(index)
  }

  function setIndex(i, animate, notify) {
    const next = Math.max(0, Math.min(max, Math.round(i)))
    const changed = next !== index
    if (!changed && !notify) return
    index = next
    applyTransform(animate)
    if (notify && changed) onCommit(index)
  }

  function clampTy(ty) {
    const lo = tyForIndex(max)
    const hi = tyForIndex(0)
    return Math.min(hi, Math.max(lo, ty))
  }

  function endDrag() {
    dragPointerId = null
    isMouseDragging = false
    isTouchDragging = false
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDocUp)
    document.removeEventListener('pointercancel', onDocUp)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
    document.removeEventListener('touchcancel', onTouchEnd)
    setIndex(indexFromTy(translateY), true, true)
  }

  /** @param {PointerEvent} e */
  function onDocMove(e) {
    if (dragPointerId !== e.pointerId) return
    const dy = e.clientY - dragStartClientY
    translateY = clampTy(dragStartTranslate + dy)
    track.style.transition = 'none'
    track.style.transform = `translate3d(0, ${translateY}px, 0)`
    setVisualRow(indexFromTy(translateY))
  }

  /** @param {PointerEvent} e */
  function onDocUp(e) {
    if (dragPointerId !== e.pointerId) return
    endDrag()
  }

  /** @param {MouseEvent} e */
  function onMouseMove(e) {
    if (!isMouseDragging) return
    const dy = e.clientY - dragStartClientY
    translateY = clampTy(dragStartTranslate + dy)
    track.style.transition = 'none'
    track.style.transform = `translate3d(0, ${translateY}px, 0)`
    setVisualRow(indexFromTy(translateY))
  }

  function onMouseUp() {
    if (!isMouseDragging) return
    endDrag()
  }

  /** @param {TouchEvent} e */
  function onTouchMove(e) {
    if (!isTouchDragging || e.touches.length === 0) return
    const touch = e.touches[0]
    const dy = touch.clientY - dragStartClientY
    translateY = clampTy(dragStartTranslate + dy)
    track.style.transition = 'none'
    track.style.transform = `translate3d(0, ${translateY}px, 0)`
    setVisualRow(indexFromTy(translateY))
  }

  function onTouchEnd() {
    if (!isTouchDragging) return
    endDrag()
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    viewport.focus({ preventScroll: true })
    dragPointerId = e.pointerId
    dragStartClientY = e.clientY
    dragStartTranslate = translateY
    document.addEventListener('pointermove', onDocMove)
    document.addEventListener('pointerup', onDocUp)
    document.addEventListener('pointercancel', onDocUp)
  })

  track.addEventListener('click', (e) => {
    if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
    const target = e.target instanceof Element ? e.target.closest('.wheel-picker__item') : null
    if (!(target instanceof HTMLElement)) return
    const value = Number(target.dataset.value)
    if (!Number.isFinite(value)) return
    setIndex(value, true, true)
    viewport.focus({ preventScroll: true })
  })

  if (!('PointerEvent' in window)) {
    viewport.addEventListener('mousedown', (e) => {
      if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
      if (e.button !== 0) return
      viewport.focus({ preventScroll: true })
      isMouseDragging = true
      dragStartClientY = e.clientY
      dragStartTranslate = translateY
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    viewport.addEventListener(
      'touchstart',
      (e) => {
        if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
        if (e.touches.length === 0) return
        const touch = e.touches[0]
        viewport.focus({ preventScroll: true })
        isTouchDragging = true
        dragStartClientY = touch.clientY
        dragStartTranslate = translateY
        document.addEventListener('touchmove', onTouchMove, { passive: true })
        document.addEventListener('touchend', onTouchEnd)
        document.addEventListener('touchcancel', onTouchEnd)
      },
      { passive: true },
    )
  }

  viewport.addEventListener(
    'wheel',
    (e) => {
      if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      setIndex(index + dir, true, true)
    },
    { passive: false },
  )

  viewport.addEventListener('keydown', (e) => {
    if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex(index - 1, true, true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex(index + 1, true, true)
    }
  })

  return {
    getIndex: () => index,
    setIndex: (i, animate = true) => {
      setIndex(i, animate, true)
    },
    setIndexSilent: (i, animate = true) => {
      setIndex(i, animate, false)
    },
    remeasure() {
      const el = track.querySelector('.wheel-picker__item')
      if (el) {
        const h = el.getBoundingClientRect().height
        if (h > 0) itemHeight = h
      }
      applyTransform(false)
    },
  }
}
