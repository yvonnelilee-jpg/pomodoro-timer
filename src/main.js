import './style.css'

const MS = 1000

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** H:M:S from remaining seconds. */
function hmsFromRemaining(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return { h, m, s }
}

/**
 * @param {HTMLElement} track
 * @param {number} max inclusive
 * @param {'hours' | 'minutes' | 'seconds'} kind
 */
function populateWheelTrack(track, max, kind) {
  track.textContent = ''
  for (let i = 0; i <= max; i++) {
    const row = document.createElement('div')
    row.className = 'wheel-picker__item'
    row.id =
      kind === 'hours' ? `wheel-h-${i}` : kind === 'minutes' ? `wheel-m-${i}` : `wheel-s-${i}`
    row.setAttribute('role', 'option')
    row.setAttribute('aria-selected', 'false')
    row.dataset.value = String(i)

    const num = document.createElement('span')
    num.className = 'wheel-picker__num'
    num.textContent = String(i)

    const unit = document.createElement('span')
    unit.className = 'wheel-picker__unit'
    /* Short labels so three columns fit; headings name each column. */
    unit.textContent = kind === 'hours' ? 'h' : kind === 'minutes' ? 'm' : 's'

    row.append(num, unit)
    track.appendChild(row)
  }
}

/**
 * @param {HTMLElement} viewport
 * @param {HTMLElement} track
 * @param {number} max inclusive
 * @param {'hours' | 'minutes' | 'seconds'} kind
 * @param {(index: number) => void} onCommit
 */
function attachWheel(viewport, track, max, kind, onCommit) {
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
    const id =
      kind === 'hours' ? `wheel-h-${v}` : kind === 'minutes' ? `wheel-m-${v}` : `wheel-s-${v}`
    viewport.setAttribute('aria-activedescendant', id)
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
    // Safari/touch can report non-zero buttons on pointer events.
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

  // Fallback for environments with limited Pointer Events support.
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
    /** layout read after fonts */
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

function initTimerApp() {
  const root = document.querySelector('.pomodoro-timer')
  const durationWheels = document.getElementById('duration-wheels')
  const wheelHoursViewport = document.getElementById('wheel-hours')
  const wheelMinutesViewport = document.getElementById('wheel-minutes')
  const wheelSecondsViewport = document.getElementById('wheel-seconds')
  const elHours = document.getElementById('timer-hours')
  const elMinutes = document.getElementById('timer-minutes')
  const elSeconds = document.getElementById('timer-seconds')
  const modeEl = document.getElementById('mode-indicator')
  const timerDisplay = document.getElementById('timer-display')
  const startPauseBtn = document.getElementById('start-pause-btn')
  const resetBtn = document.getElementById('reset-btn')

  if (
    !root ||
    !durationWheels ||
    !wheelHoursViewport ||
    !wheelMinutesViewport ||
    !wheelSecondsViewport ||
    !elHours ||
    !elMinutes ||
    !elSeconds ||
    !modeEl ||
    !timerDisplay ||
    !startPauseBtn ||
    !resetBtn
  ) {
    console.error('[pomodoro] Missing required DOM nodes; timer not initialized.')
    return
  }

  const trackHours = wheelHoursViewport.querySelector('[data-wheel-track]')
  const trackMinutes = wheelMinutesViewport.querySelector('[data-wheel-track]')
  const trackSeconds = wheelSecondsViewport.querySelector('[data-wheel-track]')
  if (
    !trackHours ||
    !trackMinutes ||
    !trackSeconds ||
    !(trackHours instanceof HTMLElement) ||
    !(trackMinutes instanceof HTMLElement) ||
    !(trackSeconds instanceof HTMLElement)
  ) {
    console.error('[pomodoro] Missing wheel tracks.')
    return
  }

  let hours = 0
  let minutes = 25
  let seconds = 0
  let totalSeconds = hours * 3600 + minutes * 60 + seconds
  let remaining = totalSeconds
  let running = false
  let tickId = 0
  let lastTick = 0

  function applyDurationFromPickers() {
    totalSeconds = hours * 3600 + minutes * 60 + seconds
    remaining = totalSeconds
    updateCountdownDisplay()
    updateTimerDatetime()
  }

  const wheelH = attachWheel(
    wheelHoursViewport,
    trackHours,
    23,
    'hours',
    (idx) => {
      hours = idx
      if (!running) applyDurationFromPickers()
    },
  )

  const wheelM = attachWheel(
    wheelMinutesViewport,
    trackMinutes,
    59,
    'minutes',
    (idx) => {
      minutes = idx
      if (!running) applyDurationFromPickers()
    },
  )

  const wheelS = attachWheel(
    wheelSecondsViewport,
    trackSeconds,
    59,
    'seconds',
    (idx) => {
      seconds = idx
      if (!running) applyDurationFromPickers()
    },
  )

  function updateCountdownDisplay() {
    const { h, m, s } = hmsFromRemaining(remaining)
    elHours.textContent = pad2(h)
    elMinutes.textContent = pad2(m)
    elSeconds.textContent = pad2(s)
    wheelH.setIndexSilent(h, false)
    wheelM.setIndexSilent(m, false)
    wheelS.setIndexSilent(s, false)
  }

  function updateTimerDatetime() {
    const { h, m, s } = hmsFromRemaining(remaining)
    timerDisplay.setAttribute('datetime', `PT${h}H${m}M${s}S`)
  }

  function setMode(text) {
    modeEl.textContent = text
  }

  function refreshUiState() {
    root.classList.toggle('is-running', running)
    root.classList.toggle('is-paused', !running && remaining < totalSeconds && remaining > 0)
    startPauseBtn.textContent = running ? 'Pause' : 'Start'
    durationWheels.classList.toggle('wheel-picker--locked', running)
    wheelHoursViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    wheelMinutesViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    wheelSecondsViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    if (running) setMode('Run')
    else if (remaining <= 0) setMode('Done')
    else if (remaining < totalSeconds) setMode('Pause')
    else setMode('Set')
  }

  function stopTimer() {
    running = false
    if (tickId) cancelAnimationFrame(tickId)
    tickId = 0
    refreshUiState()
  }

  function onTick(ts) {
    if (!running) return
    if (lastTick === 0) lastTick = ts
    const delta = ts - lastTick
    if (delta >= MS) {
      const steps = Math.floor(delta / MS)
      lastTick += steps * MS
      remaining = Math.max(0, remaining - steps)
      updateCountdownDisplay()
      updateTimerDatetime()
      if (remaining === 0) {
        stopTimer()
        setMode('Done')
      }
    }
    tickId = requestAnimationFrame(onTick)
  }

  function startTimer() {
    const planned = hours * 3600 + minutes * 60 + seconds
    if (planned <= 0) return
    if (remaining <= 0 || remaining === totalSeconds) {
      totalSeconds = planned
      remaining = totalSeconds
    }
    running = true
    lastTick = 0
    refreshUiState()
    tickId = requestAnimationFrame(onTick)
  }

  function pauseTimer() {
    running = false
    if (tickId) cancelAnimationFrame(tickId)
    tickId = 0
    refreshUiState()
  }

  wheelH.setIndex(hours, false)
  wheelM.setIndex(minutes, false)
  wheelS.setIndex(seconds, false)
  requestAnimationFrame(() => {
    wheelH.remeasure()
    wheelM.remeasure()
    wheelS.remeasure()
  })

  updateCountdownDisplay()
  updateTimerDatetime()
  refreshUiState()

  startPauseBtn.addEventListener('click', () => {
    if (running) pauseTimer()
    else startTimer()
  })

  resetBtn.addEventListener('click', () => {
    stopTimer()
    totalSeconds = hours * 3600 + minutes * 60 + seconds
    remaining = totalSeconds
    updateCountdownDisplay()
    updateTimerDatetime()
    refreshUiState()
    setMode('Set')
  })
}

function boot() {
  initTimerApp()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
