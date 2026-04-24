/**
 * Shared timing and wheel limits for the Pomodoro app.
 */

/** Milliseconds per second (used with `requestAnimationFrame` pacing). */
export const MS_PER_SECOND = 1000

/** Cap for completion alert playback (`public/audio/lofi-alert.mp3`). */
export const COMPLETION_SOUND_MAX_MS = 5000

/**
 * @typedef {'hours' | 'minutes' | 'seconds'} WheelKind
 */

/**
 * @typedef {{ id: string, ariaLabel: string, kind: WheelKind, max: number }} WheelColumnSpec
 */

/** One entry per duration column: hours, minutes, seconds. */
export const DURATION_WHEEL_SPECS = Object.freeze(
  /** @type {WheelColumnSpec[]} */ ([
    { id: 'wheel-hours', ariaLabel: 'Hours', kind: 'hours', max: 23 },
    { id: 'wheel-minutes', ariaLabel: 'Minutes', kind: 'minutes', max: 59 },
    { id: 'wheel-seconds', ariaLabel: 'Seconds', kind: 'seconds', max: 59 },
  ]),
)
