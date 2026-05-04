/**
 * Application entry: global styles + Pomodoro bootstrap on DOM ready.
 */

import './style.css'

import { initTimerApp } from './pomodoro/timer-app.js'

function boot() {
  initTimerApp()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
