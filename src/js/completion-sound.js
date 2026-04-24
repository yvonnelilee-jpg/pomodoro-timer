/**
 * End-of-countdown alert: plays public audio for a capped duration, then stops.
 * Stops any in-flight alert when `stopCompletionSound()` runs (reset / new run).
 */

import { COMPLETION_SOUND_MAX_MS } from './constants.js'

/** @type {HTMLAudioElement | null} */
let activeAudio = null

/** @type {ReturnType<typeof setTimeout> | null} */
let stopTimeoutId = null

/**
 * Resolves the alert file URL (respects Vite `base`, e.g. `./`).
 * @returns {string}
 */
function completionSoundUrl() {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? `${base}audio/lofi-alert.mp3` : `${base}/audio/lofi-alert.mp3`
}

/**
 * Stops playback and clears the auto-stop timer.
 */
export function stopCompletionSound() {
  if (stopTimeoutId !== null) {
    clearTimeout(stopTimeoutId)
    stopTimeoutId = null
  }
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
  }
}

/**
 * Plays the completion sound for up to {@link COMPLETION_SOUND_MAX_MS} ms, then pauses.
 * Restarts from the beginning if called again while still playing.
 */
export function playCompletionSound() {
  stopCompletionSound()

  const audio = new Audio(completionSoundUrl())
  audio.preload = 'auto'
  activeAudio = audio

  audio.play().catch(() => {
    /* Autoplay or missing file — ignore */
  })

  stopTimeoutId = setTimeout(() => {
    stopTimeoutId = null
    if (activeAudio === audio) {
      audio.pause()
      audio.currentTime = 0
      activeAudio = null
    }
  }, COMPLETION_SOUND_MAX_MS)
}
