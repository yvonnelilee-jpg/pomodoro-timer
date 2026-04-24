/**
 * Injects the T-Rex HTML fragment (from wayou/t-rex-runner) into the host once.
 * Loads the shared runner script; calls `startPomodoroTrexRunner` from `t-rex-runner.index.js`.
 */

import trexFragment from './trex-embed-fragment.html?raw'
import trexRunnerUrl from '../t-rex-runner.index.js?url'

const TREX_INTERSTITIAL = '#pomodoro-trex-interstitial'

let runnerScriptPromise = null

function loadTrexRunnerScript() {
  if (runnerScriptPromise) return runnerScriptPromise
  runnerScriptPromise = new Promise((resolve, reject) => {
    if (window.startPomodoroTrexRunner) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = trexRunnerUrl
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load t-rex-runner.index.js'))
    document.head.appendChild(s)
  })
  return runnerScriptPromise
}

/**
 * @param {HTMLElement} host
 */
export async function ensurePomodoroTrex(host) {
  if (!host) return
  if (host.dataset.pomodoroTrexInjected) {
    await loadTrexRunnerScript()
    window.startPomodoroTrexRunner?.(TREX_INTERSTITIAL)
    if (window.Runner && window.Runner.instance_) {
      window.Runner.instance_.startListening()
    }
    return
  }
  host.innerHTML = trexFragment
  host.dataset.pomodoroTrexInjected = '1'
  await loadTrexRunnerScript()
  window.startPomodoroTrexRunner?.(TREX_INTERSTITIAL)
}

export function pausePomodoroTrexInput() {
  if (window.Runner && window.Runner.instance_) {
    window.Runner.instance_.stopListening()
  }
}
