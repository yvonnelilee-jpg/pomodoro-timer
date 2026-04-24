/**
 * Pomodoro timer application: wires duration wheels, flip readout, and controls.
 */

import { MS_PER_SECOND, DURATION_WHEEL_SPECS } from './constants.js'
import { pad2, hmsFromRemaining } from './time-utils.js'
import { createFlipTile } from './flip-tile.js'
import { mountWheelPickerColumns, attachWheel } from './wheel-picker.js'
import { playCompletionSound, stopCompletionSound } from './completion-sound.js'
import { runWheelCompletionCelebration } from './completion-celebration.js'

/**
 * Query required elements and start listeners. No-op if DOM is incomplete.
 */
export function initTimerApp() {
  const root = document.querySelector('.pomodoro-timer')
  const durationWheels = document.getElementById('duration-wheels')
  const wheelColumnsRoot = document.getElementById('wheel-picker-columns')
  const tileHours = document.getElementById('timer-hours')
  const tileMinutes = document.getElementById('timer-minutes')
  const tileSeconds = document.getElementById('timer-seconds')
  const modeEl = document.getElementById('mode-indicator')
  const timerDisplay = document.getElementById('timer-display')
  const startPauseBtn = document.getElementById('start-pause-btn')
  const resetBtn = document.getElementById('reset-btn')

  if (
    !root ||
    !durationWheels ||
    !wheelColumnsRoot ||
    !(tileHours instanceof HTMLElement) ||
    !(tileMinutes instanceof HTMLElement) ||
    !(tileSeconds instanceof HTMLElement) ||
    !modeEl ||
    !timerDisplay ||
    !startPauseBtn ||
    !resetBtn
  ) {
    console.error('[pomodoro] Missing required DOM nodes; timer not initialized.')
    return
  }

  mountWheelPickerColumns(wheelColumnsRoot, DURATION_WHEEL_SPECS)

  const wheelHoursViewport = document.getElementById('wheel-hours')
  const wheelMinutesViewport = document.getElementById('wheel-minutes')
  const wheelSecondsViewport = document.getElementById('wheel-seconds')
  if (!wheelHoursViewport || !wheelMinutesViewport || !wheelSecondsViewport) {
    console.error('[pomodoro] Wheel columns failed to mount.')
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
  /** @type {AbortController | null} */
  let celebrationAbort = null

  const specH = DURATION_WHEEL_SPECS[0]
  const specM = DURATION_WHEEL_SPECS[1]
  const specS = DURATION_WHEEL_SPECS[2]

  const wheelH = attachWheel(
    wheelHoursViewport,
    trackHours,
    specH.max,
    specH.kind,
    (idx) => {
      hours = idx
      if (!running) applyDurationFromPickers()
    },
  )

  const wheelM = attachWheel(
    wheelMinutesViewport,
    trackMinutes,
    specM.max,
    specM.kind,
    (idx) => {
      minutes = idx
      if (!running) applyDurationFromPickers()
    },
  )

  const wheelS = attachWheel(
    wheelSecondsViewport,
    trackSeconds,
    specS.max,
    specS.kind,
    (idx) => {
      seconds = idx
      if (!running) applyDurationFromPickers()
    },
  )

  const flipHours = createFlipTile(tileHours)
  const flipMinutes = createFlipTile(tileMinutes)
  const flipSeconds = createFlipTile(tileSeconds)

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

  /** Restore readout and wheels to the full length of the current session (`totalSeconds`). */
  function restoreSessionDuration() {
    const { h, m, s } = hmsFromRemaining(totalSeconds)
    hours = h
    minutes = m
    seconds = s
    applyDurationFromPickers()
    refreshUiState()
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

  /** @param {DOMHighResTimeStamp} ts */
  function onTick(ts) {
    if (!running) return
    if (lastTick === 0) lastTick = ts
    const delta = ts - lastTick
    if (delta >= MS_PER_SECOND) {
      const steps = Math.floor(delta / MS_PER_SECOND)
      lastTick += steps * MS_PER_SECOND
      remaining = Math.max(0, remaining - steps)
      updateCountdownDisplay(true)
      updateTimerDatetime()
      if (remaining === 0) {
        stopTimer()
        setMode('Done')
        playCompletionSound()
        celebrationAbort?.abort()
        const ac = new AbortController()
        celebrationAbort = ac
        void runWheelCompletionCelebration(durationWheels, { signal: ac.signal }).finally(() => {
          if (celebrationAbort === ac) celebrationAbort = null
          if (!ac.signal.aborted) restoreSessionDuration()
        })
      }
    }
    tickId = requestAnimationFrame(onTick)
  }

  function startTimer() {
    const planned = hours * 3600 + minutes * 60 + seconds
    if (planned <= 0) return
    stopCompletionSound()
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
    celebrationAbort?.abort()
    stopCompletionSound()
    stopTimer()
    restoreSessionDuration()
  })
}
