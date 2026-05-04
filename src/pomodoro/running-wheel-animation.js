/**
 * Ambient animation overlay shown in the wheel card while the timer runs.
 */

import { getWheelPickerLayoutTarget } from './wheel-picker.js'

const SHAPE_COUNT = 46
const ORB_COUNT = 8

/**
 * @typedef {'dot' | 'bubble' | 'capsule'} ShapeKind
 */

/**
 * @param {HTMLElement} root `#duration-wheels`
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<void>}
 */
export function runWheelRunningAnimation(root, opts = {}) {
  const { signal } = opts

  return new Promise((resolve) => {
    const chrome = getWheelPickerLayoutTarget(root)
    if (!(root instanceof HTMLElement) || !(chrome instanceof HTMLElement) || signal?.aborted) {
      resolve()
      return
    }

    const canvas = document.createElement('canvas')
    canvas.className = 'wheel-picker__running-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    const cs = getComputedStyle(chrome)
    canvas.style.borderRadius = cs.borderRadius

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve()
      return
    }

    root.classList.add('wheel-picker--animating')
    root.appendChild(canvas)

    /** @type {{ kind: ShapeKind, x: number, y: number, vx: number, vy: number, size: number, alpha: number, seed: number }[]} */
    const shapes = []
    for (let i = 0; i < SHAPE_COUNT; i++) {
      shapes.push({
        kind: Math.random() < 0.56 ? 'dot' : Math.random() < 0.82 ? 'bubble' : 'capsule',
        x: Math.random(),
        y: Math.random(),
        vx: 0.00008 + Math.random() * 0.00026,
        vy: (Math.random() - 0.5) * 0.00005,
        size: 2.5 + Math.random() * 12,
        alpha: 0.08 + Math.random() * 0.33,
        seed: Math.random() * Math.PI * 2,
      })
    }
    /** @type {{ x: number, y: number, vx: number, vy: number, r: number, alpha: number, seed: number }[]} */
    const orbs = []
    for (let i = 0; i < ORB_COUNT; i++) {
      orbs.push({
        x: Math.random(),
        y: Math.random(),
        vx: 0.00002 + Math.random() * 0.00008,
        vy: (Math.random() - 0.5) * 0.00003,
        r: 14 + Math.random() * 26,
        alpha: 0.08 + Math.random() * 0.13,
        seed: Math.random() * Math.PI * 2,
      })
    }

    let raf = 0
    let settled = false
    let lastTs = 0
    let w = 0
    let h = 0

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = chrome.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.left = `${Math.round(rect.left - rootRect.left)}px`
      canvas.style.top = `${Math.round(rect.top - rootRect.top)}px`
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onResize = () => layout()
    window.addEventListener('resize', onResize)
    layout()

    const finish = () => {
      if (settled) return
      settled = true
      if (raf) cancelAnimationFrame(raf)
      signal?.removeEventListener('abort', onAbort)
      window.removeEventListener('resize', onResize)
      root.classList.remove('wheel-picker--animating')
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
      if (!lastTs) lastTs = ts
      const dt = ts - lastTs
      lastTs = ts

      const gradient = ctx.createLinearGradient(0, 0, 0, h)
      gradient.addColorStop(0, '#03040a')
      gradient.addColorStop(0.5, '#090d1a')
      gradient.addColorStop(1, '#020307')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      const nebulaX = w * (0.42 + Math.sin(ts * 0.00018) * 0.1)
      const nebulaY = h * (0.5 + Math.cos(ts * 0.00016) * 0.08)
      const nebula = ctx.createRadialGradient(nebulaX, nebulaY, 10, nebulaX, nebulaY, Math.max(w, h) * 0.68)
      nebula.addColorStop(0, 'rgba(132, 112, 255, 0.2)')
      nebula.addColorStop(0.45, 'rgba(66, 110, 220, 0.13)')
      nebula.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = nebula
      ctx.fillRect(0, 0, w, h)

      const t = ts * 0.001
      const waveBaseY = h * 0.46 + Math.sin(t * 0.7) * (h * 0.05)
      const waveAmpA = h * 0.032
      const waveAmpB = h * 0.015
      const waveFreqA = (Math.PI * 2) / Math.max(220, w * 0.6)
      const waveFreqB = (Math.PI * 2) / Math.max(130, w * 0.35)
      const waveYAt = (x, phase = 0) =>
        waveBaseY +
        Math.sin(x * waveFreqA + t * 1.5 + phase) * waveAmpA +
        Math.sin(x * waveFreqB - t * 0.95 + phase * 0.6) * waveAmpB

      // Soft ribbon glow around the wave path.
      const waveBandH = Math.max(16, h * 0.22)
      const waveGlow = ctx.createLinearGradient(0, waveBaseY - waveBandH, 0, waveBaseY + waveBandH)
      waveGlow.addColorStop(0, 'rgba(92, 170, 255, 0)')
      waveGlow.addColorStop(0.42, 'rgba(108, 184, 255, 0.07)')
      waveGlow.addColorStop(0.5, 'rgba(210, 238, 255, 0.16)')
      waveGlow.addColorStop(0.58, 'rgba(108, 184, 255, 0.07)')
      waveGlow.addColorStop(1, 'rgba(92, 170, 255, 0)')
      ctx.fillStyle = waveGlow
      ctx.fillRect(0, waveBaseY - waveBandH, w, waveBandH * 2)

      // Layered wave lines for ripple depth.
      const drawWave = (phase, alpha, width) => {
        ctx.beginPath()
        ctx.moveTo(0, waveYAt(0, phase))
        const step = 8
        for (let x = step; x <= w; x += step) {
          ctx.lineTo(x, waveYAt(x, phase))
        }
        ctx.strokeStyle = `rgba(220, 242, 255, ${alpha})`
        ctx.lineWidth = width
        ctx.stroke()
      }
      drawWave(0, 0.33, 1.5)
      drawWave(Math.PI * 0.45, 0.2, 1.05)
      drawWave(Math.PI * 0.95, 0.12, 0.85)

      // Traveling circular ripples along the wave.
      for (let i = 0; i < 3; i++) {
        const travel = ((t * (0.055 + i * 0.014) + i * 0.31) % 1 + 1) % 1
        const cx = travel * w
        const cy = waveYAt(cx, i * 0.7)
        const pulse = (Math.sin(t * 2.2 + i * 1.4) + 1) * 0.5
        const radius = 5 + pulse * (10 + i * 2.4)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(180, 222, 255, ${0.2 - i * 0.04})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      for (const orb of orbs) {
        const t = ts * 0.001
        orb.vx = orb.vx * 0.992 + Math.sin(t * 0.35 + orb.seed) * 0.000002
        orb.vy = orb.vy * 0.992 + Math.cos(t * 0.45 + orb.seed * 0.7) * 0.0000018
        orb.x += orb.vx * dt
        orb.y += orb.vy * dt
        if (orb.x > 1.12) orb.x = -0.12
        if (orb.x < -0.12) orb.x = 1.12
        if (orb.y > 1.1) orb.y = -0.1
        if (orb.y < -0.1) orb.y = 1.1
        const x = orb.x * w
        const y = orb.y * h
        const g = ctx.createRadialGradient(x, y, 0, x, y, orb.r)
        g.addColorStop(0, `rgba(228, 241, 255, ${orb.alpha * 1.7})`)
        g.addColorStop(0.35, `rgba(140, 186, 255, ${orb.alpha})`)
        g.addColorStop(1, 'rgba(120, 158, 255, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, orb.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const shape of shapes) {
        const t = ts * 0.001
        const swayX = Math.sin(t * 0.72 + shape.seed) * 0.00009
        const swayY = Math.cos(t * 0.94 + shape.seed * 0.6) * 0.00007

        // Blend target drift with oscillation for smoother, fluid motion.
        shape.vx = shape.vx * 0.975 + swayX * 0.025
        shape.vy = shape.vy * 0.975 + swayY * 0.025

        shape.x += shape.vx * dt
        shape.y += shape.vy * dt

        if (shape.x > 1.12) shape.x = -0.12
        if (shape.x < -0.12) shape.x = 1.12
        if (shape.y > 1.1) shape.y = -0.1
        if (shape.y < -0.1) shape.y = 1.1

        const x = shape.x * w
        const y = shape.y * h
        ctx.fillStyle = `rgba(212, 233, 255, ${shape.alpha})`

        if (shape.kind === 'dot') {
          ctx.beginPath()
          ctx.arc(x, y, shape.size * 0.36, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        if (shape.kind === 'bubble') {
          const r = shape.size * 0.52
          const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r)
          g.addColorStop(0, `rgba(238, 248, 255, ${shape.alpha * 1.45})`)
          g.addColorStop(0.45, `rgba(194, 224, 255, ${shape.alpha * 0.95})`)
          g.addColorStop(1, `rgba(160, 205, 255, ${shape.alpha * 0.15})`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const barW = shape.size * 1.7
        const barH = Math.max(1.8, shape.size * 0.44)
        const radius = barH * 0.5
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.sin(t * 0.72 + shape.seed) * 0.24)
        ctx.beginPath()
        ctx.moveTo(-barW / 2 + radius, -barH / 2)
        ctx.lineTo(barW / 2 - radius, -barH / 2)
        ctx.quadraticCurveTo(barW / 2, -barH / 2, barW / 2, -barH / 2 + radius)
        ctx.lineTo(barW / 2, barH / 2 - radius)
        ctx.quadraticCurveTo(barW / 2, barH / 2, barW / 2 - radius, barH / 2)
        ctx.lineTo(-barW / 2 + radius, barH / 2)
        ctx.quadraticCurveTo(-barW / 2, barH / 2, -barW / 2, barH / 2 - radius)
        ctx.lineTo(-barW / 2, -barH / 2 + radius)
        ctx.quadraticCurveTo(-barW / 2, -barH / 2, -barW / 2 + radius, -barH / 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      const scanStep = 5
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      for (let y = 0; y < h; y += scanStep) {
        ctx.fillRect(0, y, w, 1)
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
  })
}
