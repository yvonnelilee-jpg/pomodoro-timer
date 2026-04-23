import './style.css'

const MS = 1000

function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Build a split-flap renderer on top of a timer digits span.
 * @param {HTMLElement} digitsEl
 */
function createFlipTile(digitsEl) {
  const tile = digitsEl.closest('.flip-tile')
  if (!(tile instanceof HTMLElement)) {
    return {
      setValue(next) {
        digitsEl.textContent = next
      },
    }
  }

  const initial = digitsEl.textContent?.trim() || '00'
  digitsEl.remove()

  const topStatic = document.createElement('span')
  topStatic.className = 'flip-tile__half flip-tile__half--top'
  const topStaticText = document.createElement('span')
  topStaticText.className = 'flip-tile__text'
  topStaticText.textContent = initial
  topStatic.appendChild(topStaticText)

  const bottomStatic = document.createElement('span')
  bottomStatic.className = 'flip-tile__half flip-tile__half--bottom'
  const bottomStaticText = document.createElement('span')
  bottomStaticText.className = 'flip-tile__text'
  bottomStaticText.textContent = initial
  bottomStatic.appendChild(bottomStaticText)

  const topFlap = document.createElement('span')
  topFlap.className = 'flip-tile__flap flip-tile__flap--top'
  const topFlapText = document.createElement('span')
  topFlapText.className = 'flip-tile__text'
  topFlap.appendChild(topFlapText)

  const bottomFlap = document.createElement('span')
  bottomFlap.className = 'flip-tile__flap flip-tile__flap--bottom'
  const bottomFlapText = document.createElement('span')
  bottomFlapText.className = 'flip-tile__text'
  bottomFlap.appendChild(bottomFlapText)

  tile.append(topStatic, bottomStatic, topFlap, bottomFlap)

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
    tile.classList.remove('is-flipping')
    flipRafId = requestAnimationFrame(() => {
      tile.classList.add('is-flipping')
      flipRafId = 0
    })
  }

  bottomFlap.addEventListener('animationend', () => {
    if (!flipping) return
    tile.classList.remove('is-flipping')
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
     * @param {string} next
     * @param {boolean} animate
     */
    setValue(next, animate = true) {
      if (next === current) return
      if (!animate || reduceMotion.matches) {
        queued = ''
        if (flipRafId) {
          cancelAnimationFrame(flipRafId)
          flipRafId = 0
        }
        tile.classList.remove('is-flipping')
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
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDocUp)
    document.removeEventListener('pointercancel', onDocUp)
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

  viewport.addEventListener('pointerdown', (e) => {
    if (viewport.classList.contains('wheel-picker__viewport--disabled')) return
    if (e.button !== 0) return
    e.preventDefault()
    viewport.focus({ preventScroll: true })
    dragPointerId = e.pointerId
    dragStartClientY = e.clientY
    dragStartTranslate = translateY
    document.addEventListener('pointermove', onDocMove)
    document.addEventListener('pointerup', onDocUp)
    document.addEventListener('pointercancel', onDocUp)
  })

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

  const flipHours = createFlipTile(elHours)
  const flipMinutes = createFlipTile(elMinutes)
  const flipSeconds = createFlipTile(elSeconds)

  function updateCountdownDisplay(animate = false) {
    const { h, m, s } = hmsFromRemaining(remaining)
    flipHours.setValue(pad2(h), animate)
    flipMinutes.setValue(pad2(m), animate)
    flipSeconds.setValue(pad2(s), animate)
    wheelH.setIndexSilent(h, false)
    wheelM.setIndexSilent(m, false)
    wheelS.setIndexSilent(s, false)
  }

  function applyDurationFromPickers() {
    totalSeconds = hours * 3600 + minutes * 60 + seconds
    remaining = totalSeconds
    updateCountdownDisplay(false)
    updateTimerDatetime()
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
      updateCountdownDisplay(true)
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

  updateCountdownDisplay(false)
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
    updateCountdownDisplay(false)
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
