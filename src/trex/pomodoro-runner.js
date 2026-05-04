import { Runner } from './engine/dino_game/offline.js'

/** Module-local instance — avoids relying on window.Runner.instance_. */
let instance = null

/**
 * Create the Runner once and attach it to the given container element.
 * Safe to call multiple times: subsequent calls are no-ops (the instance
 * already exists and is listening).
 * @param {HTMLElement} containerEl
 */
export function startPomodoroTrex(containerEl) {
  if (instance) return
  instance = new Runner(containerEl)
}

/**
 * Suspend keyboard / pointer input forwarding to the dino game while
 * the timer screen is visible.
 */
export function pausePomodoroTrexInput() {
  instance?.stopListening()
}

/**
 * Restore input forwarding when the user switches back to the dino screen.
 */
export function resumePomodoroTrexInput() {
  instance?.startListening()
}
