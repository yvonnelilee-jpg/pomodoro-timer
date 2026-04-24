/**
 * Full-screen overlay on the duration wheel: B&W pixel “confetti burst” (iOS-style explode),
 * then teardown so the wheel is usable again.
 */

import { getWheelPickerLayoutTarget } from './wheel-picker.js'

const BW = ['#ffffff', '#e6e6e6', '#b8b8b8', '#7a7a7a', '#444444', '#1c1c1c']

const CELEBRATION_MS = 2600

/**
 * @typedef {{
 *   x: number
 *   y: number
 *   vx: number
 *   vy: number
 *   size: number
 *   color: string
 *   spin: number
 *   spinV: number
 * }} PixelBit
 */

/**
 * @param {number} w
 * @param {number} h
 * @param {PixelBit[]} out
 */
function spawnBurst(w, h, out) {
  const count = 110
  for (let i = 0; i < count; i++) {
    const along = (i / count - 0.5) * w * 0.92
    const x = w * 0.5 + along * 0.35 + (Math.random() - 0.5) * 24
    const y = h * 0.78 + (Math.random() - 0.5) * (h * 0.12)
    const spread = (Math.random() - 0.5) * 4.2
    const lift = 7 + Math.random() * 9
    out.push({
      x,
      y,
      vx: spread + (Math.random() - 0.5) * 1.2,
      vy: -lift - Math.random() * 5,
      size: 2 + Math.floor(Math.random() * 4),
      color: BW[Math.floor(Math.random() * BW.length)],
      spin: (Math.random() - 0.5) * Math.PI,
      spinV: (Math.random() - 0.5) * 0.18,
    })
  }
  const extra = 45
  for (let j = 0; j < extra; j++) {
    const x = Math.random() * w
    const y = h * 0.55 + Math.random() * (h * 0.35)
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.1
    const sp = 2 + Math.random() * 6
    out.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      size: 2 + Math.floor(Math.random() * 3),
      color: BW[Math.floor(Math.random() * BW.length)],
      spin: Math.random() * Math.PI,
      spinV: (Math.random() - 0.5) * 0.12,
    })
  }
}

/**
 * @param {HTMLElement} root `#duration-wheels`
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<void>}
 */
export function runWheelCompletionCelebration(root, opts = {}) {
  const { signal } = opts

  return new Promise((resolve) => {
    const chrome = getWheelPickerLayoutTarget(root)
    if (!(root instanceof HTMLElement) || !(chrome instanceof HTMLElement)) {
      resolve()
      return
    }
    if (signal?.aborted) {
      resolve()
      return
    }

    const canvas = document.createElement('canvas')
    canvas.className = 'wheel-picker__celebration-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    const cs = getComputedStyle(chrome)
    canvas.style.borderRadius = cs.borderRadius

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve()
      return
    }
    ctx.imageSmoothingEnabled = false

    root.appendChild(canvas)
    root.classList.add('wheel-picker--celebrating')

    /** @type {PixelBit[]} */
    const bits = []
    let raf = 0
    let start = 0
    let settled = false

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = chrome.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.left = `${Math.round(rect.left - rootRect.left)}px`
      canvas.style.top = `${Math.round(rect.top - rootRect.top)}px`
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { w, h }
    }

    let { w, h } = layout()
    spawnBurst(w, h, bits)

    const onResize = () => {
      ;({ w, h } = layout())
    }
    window.addEventListener('resize', onResize)

    const gravity = 0.38

    const finish = () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
      root.classList.remove('wheel-picker--celebrating')
      canvas.remove()
      resolve()
    }

    function onAbort() {
      finish()
    }
    signal?.addEventListener('abort', onAbort)

    /** @param {number} ts */
    const frame = (ts) => {
      if (signal?.aborted) {
        finish()
        return
      }
      if (!start) start = ts
      const elapsed = ts - start

      ctx.fillStyle = '#080808'
      ctx.fillRect(0, 0, w, h)

      for (const p of bits) {
        p.vy += gravity
        p.vx *= 0.992
        p.x += p.vx
        p.y += p.vy
        p.spin += p.spinV
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.color
        const s = p.size
        ctx.fillRect(-s / 2, -s / 2, s, s)
        ctx.restore()
      }

      const stillFlying = bits.some((p) => p.y < h + 24 && p.x > -20 && p.x < w + 20)
      if (elapsed < CELEBRATION_MS && stillFlying) {
        raf = requestAnimationFrame(frame)
      } else {
        finish()
      }
    }

    raf = requestAnimationFrame(frame)
  })
}
