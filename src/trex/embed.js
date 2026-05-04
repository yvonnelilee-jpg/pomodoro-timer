/**
 * Injects the T-Rex HTML fragment into its host element and boots the runner
 * the first time. On subsequent calls (user switching back to the Dino screen)
 * it simply re-enables input listening without re-initialising the game.
 */

import trexFragment from './embed-fragment.html?raw'
import {
  startPomodoroTrex,
  pausePomodoroTrexInput,
  resumePomodoroTrexInput,
} from './pomodoro-runner.js'

const TREX_INTERSTITIAL_ID = 'pomodoro-trex-interstitial'

/**
 * @param {HTMLElement} host
 */
export function ensurePomodoroTrex(host) {
  if (!host) return
  if (host.dataset.pomodoroTrexInjected) {
    resumePomodoroTrexInput()
    return
  }
  host.innerHTML = trexFragment
  host.dataset.pomodoroTrexInjected = '1'
  const containerEl = host.querySelector(`#${TREX_INTERSTITIAL_ID}`)
  startPomodoroTrex(/** @type {HTMLElement} */ (containerEl))
}

export { pausePomodoroTrexInput }
