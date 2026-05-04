/**
 * Time formatting helpers for countdown display and `<time datetime>`.
 */

/**
 * @param {number} n Integer in range 0–99 (or wider; still zero-pads to width 2).
 * @returns {string}
 */
export function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Split remaining seconds into clock components.
 * @param {number} sec Non-negative whole seconds.
 * @returns {{ h: number, m: number, s: number }}
 */
export function hmsFromRemaining(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return { h, m, s }
}
