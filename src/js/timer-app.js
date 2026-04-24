/**
 * Pomodoro timer application: wires duration wheels, flip readout, and controls.
 */

import { MS_PER_SECOND, DURATION_WHEEL_SPECS } from './constants.js'
import { pad2, hmsFromRemaining } from './time-utils.js'
import { createFlipTile } from './flip-tile.js'
import { mountWheelPickerColumns, attachWheel } from './wheel-picker.js'
import { ensurePomodoroTrex, pausePomodoroTrexInput } from '../trex-embed.js'
import { playCompletionSound, stopCompletionSound } from './completion-sound.js'
import { runWheelCompletionCelebration } from './completion-celebration.js'
import { runWheelRunningAnimation } from './running-wheel-animation.js'

/** Minute values shown in the preset knob (hours and seconds cleared when applied). */
const PRESET_MINUTES = Object.freeze([5, 10, 15, 25, 50])

/**
 * Query required elements and start listeners. No-op if DOM is incomplete.
 */
export function initTimerApp() {
  const THEME_KEY = 'pomodoro-theme'
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
  const themeSelect = document.getElementById('theme-select')
  const presetSelect = document.getElementById('preset-duration-select')
  const screenContentSelect = document.getElementById('screen-content-select')
  const wheelPanelWheels = document.getElementById('wheel-picker-panel-wheels')
  const wheelPanelTrex = document.getElementById('wheel-picker-panel-trex')
  const trexEmbedHost = document.getElementById('pomodoro-trex-embed-host')

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
    !resetBtn ||
    !(themeSelect instanceof HTMLSelectElement) ||
    !(presetSelect instanceof HTMLSelectElement) ||
    !(screenContentSelect instanceof HTMLSelectElement) ||
    !wheelPanelWheels ||
    !wheelPanelTrex ||
    !trexEmbedHost
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
  /** @type {AbortController | null} */
  let runningAnimationAbort = null

  /** @type {'duration' | 'trex'} */
  let screenContentMode = 'duration'

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

  /**
   * @param {string} nextTheme
   */
  function applyTheme(nextTheme) {
    const themeAliases = {
      classic: 'parchment',
      green: 'olive',
      amber: 'turquoise',
      apricot: 'turquoise',
      ice: 'parchment',
    }
    const normalized = themeAliases[nextTheme] || nextTheme
    const theme = ['oxblood', 'parchment', 'brick', 'turquoise', 'olive'].includes(normalized)
      ? normalized
      : 'parchment'
    root.dataset.theme = theme
    themeSelect.value = theme
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Ignore storage errors (private mode / disabled storage).
    }
  }

  function syncPresetSelectFromTotal() {
    const { h, m, s } = hmsFromRemaining(totalSeconds)
    const matchPreset =
      h === 0 && s === 0 && PRESET_MINUTES.includes(m) ? String(m) : 'custom'
    presetSelect.value = matchPreset
  }

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
    syncPresetSelectFromTotal()
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

  function maybeStartRunningWheelOverlay() {
    if (!running || screenContentMode !== 'duration') return
    runningAnimationAbort?.abort()
    const ac = new AbortController()
    runningAnimationAbort = ac
    void runWheelRunningAnimation(durationWheels, { signal: ac.signal }).finally(() => {
      if (runningAnimationAbort === ac) runningAnimationAbort = null
    })
  }

  /**
   * @param {'duration' | 'trex'} mode
   */
  function applyScreenContentMode(mode) {
    if (mode !== 'duration' && mode !== 'trex') return
    screenContentMode = mode
    if (mode === 'duration') {
      wheelPanelTrex.hidden = true
      wheelPanelWheels.hidden = false
      pausePomodoroTrexInput()
      maybeStartRunningWheelOverlay()
    } else {
      runningAnimationAbort?.abort()
      runningAnimationAbort = null
      wheelPanelWheels.hidden = true
      wheelPanelTrex.hidden = false
      void ensurePomodoroTrex(trexEmbedHost)
    }
  }

  function refreshUiState() {
    root.classList.toggle('is-running', running)
    root.classList.toggle('is-paused', !running && remaining < totalSeconds && remaining > 0)
    startPauseBtn.textContent = running ? 'Pause' : 'Start'
    durationWheels.classList.toggle('wheel-picker--locked', running)
    wheelHoursViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    wheelMinutesViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    wheelSecondsViewport.classList.toggle('wheel-picker__viewport--disabled', running)
    presetSelect.disabled = running
    screenContentSelect.disabled = running
    if (running) setMode('Run')
    else if (remaining <= 0) setMode('Done')
    else if (remaining < totalSeconds) setMode('Pause')
    else setMode('Set')
  }

  function stopTimer() {
    running = false
    if (tickId) cancelAnimationFrame(tickId)
    tickId = 0
    runningAnimationAbort?.abort()
    runningAnimationAbort = null
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
      // Keep flip-tile logic available, but disable flip animation while ticking.
      updateCountdownDisplay(false)
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
    maybeStartRunningWheelOverlay()
    refreshUiState()
    tickId = requestAnimationFrame(onTick)
  }

  function pauseTimer() {
    running = false
    if (tickId) cancelAnimationFrame(tickId)
    tickId = 0
    runningAnimationAbort?.abort()
    runningAnimationAbort = null
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
  syncPresetSelectFromTotal()
  const savedTheme = (() => {
    try {
      return window.localStorage.getItem(THEME_KEY) || 'parchment'
    } catch {
      return 'parchment'
    }
  })()
  applyTheme(savedTheme)
  refreshUiState()

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value)
  })

  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === 'custom') return
    const next = Number.parseInt(presetSelect.value, 10)
    if (!Number.isFinite(next) || !PRESET_MINUTES.includes(next)) return
    hours = 0
    minutes = next
    seconds = 0
    applyDurationFromPickers()
    refreshUiState()
  })

  screenContentSelect.addEventListener('change', () => {
    const v = screenContentSelect.value
    if (v === 'duration' || v === 'trex') {
      applyScreenContentMode(v)
    }
  })

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
