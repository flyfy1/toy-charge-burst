import { audio, pentaFreq, type Riser } from './engine/AudioEngine'
import { track } from './analytics'
import { Flash, HitStop, Particles, Shake, haptic, rand, runLoop, setupCanvas } from './engine/juice'

const FULL_TIME = 2.2 // seconds to reach critical
const TAP_THRESHOLD = 0.1 // below this charge a release counts as a tap

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  s: number
}

interface Ring {
  x: number
  y: number
  r: number
  v: number
  life: number
  max: number
  w: number
  hue: number
}

export function startGame(canvas: HTMLCanvasElement, onFirst: () => void): () => void {
  const { stage, dispose } = setupCanvas(canvas)
  const shake = new Shake(34, 0.06, 1.4)
  const stop = new HitStop()
  const flash = new Flash()
  const parts = new Particles(3000)
  const rings: Ring[] = []
  const dust: Dust[] = []

  let holding = false
  let charge = 0
  let coreScale = 1
  let riser: Riser | null = null
  let lastTap = 0
  let combo = 0
  let px = 0
  let py = 0
  let banner = { text: '', t: 0, hue: 0 }
  let first = true
  let time = 0

  const cx = () => stage.w / 2
  const cy = () => stage.h / 2
  const minDim = () => Math.min(stage.w, stage.h)

  const spawnDust = (d?: Dust): Dust => {
    const a = Math.random() * Math.PI * 2
    const r = Math.max(stage.w, stage.h) * rand(0.35, 0.75)
    const o = d ?? ({} as Dust)
    o.x = cx() + Math.cos(a) * r
    o.y = cy() + Math.sin(a) * r
    // gentle orbit
    o.vx = -Math.sin(a) * rand(10, 40)
    o.vy = Math.cos(a) * rand(10, 40)
    o.hue = rand(170, 320)
    o.s = rand(1, 3)
    return o
  }
  for (let i = 0; i < 380; i++) dust.push(spawnDust())

  const ring = (x: number, y: number, v: number, life: number, w: number, hue: number) => rings.push({ x, y, r: 4, v, life, max: life, w, hue })

  const explode = (power: number) => {
    const x = cx()
    const y = cy()
    const crit = power >= 0.99
    stop.trigger(crit ? 60 : 30 + 20 * power)
    flash.fire(crit ? 1 : 0.35 + 0.5 * power)
    shake.add(crit ? 1 : 0.35 + 0.55 * power)
    audio.boom(0.35 + 0.65 * power)
    if (crit) audio.chord([pentaFreq(10, 110), pentaFreq(12, 110), pentaFreq(14, 110), pentaFreq(15, 110)], 1.6, 0.12, 0.02)
    haptic(crit ? [30, 20, 80, 40, 140] : [25, 15, 60])
    const n = Math.round(180 + 650 * power)
    const sp = 500 + 1500 * power
    const hueBase = rand(0, 360)
    parts.burst(x, y, n, { speed: sp, hue: () => hueBase + rand(0, 200), life: 1.4, size: 5, drag: 0.955 })
    parts.burst(x, y, Math.round(n / 3), { speed: sp * 0.35, hue: 50, light: 85, life: 0.7, size: 7 })
    ring(x, y, 1600 * (0.5 + power), 0.7, 30 * power + 6, hueBase)
    if (crit) {
      ring(x, y, 900, 1.0, 50, hueBase + 120)
      ring(x, y, 2600, 0.5, 14, 60)
      banner = { text: 'CRITICAL!', t: 1, hue: hueBase }
      track('critical')
    }
    // blast dust outward
    for (const d of dust) {
      const dx = d.x - x
      const dy = d.y - y
      const dist = Math.hypot(dx, dy) + 1
      const f = (2600 * power) / Math.sqrt(dist)
      d.vx += (dx / dist) * f * 10
      d.vy += (dy / dist) * f * 10
    }
    coreScale = 0
    combo = 0
  }

  const tapBurst = (x: number, y: number) => {
    const now = time
    combo = now - lastTap < 0.6 ? combo + 1 : 0
    lastTap = now
    const step = combo % 15
    audio.blip(pentaFreq(step, 220), 0.3)
    shake.add(0.22 + Math.min(0.25, combo * 0.02))
    flash.fire(0.08, '255,220,200')
    haptic(18)
    const hue = (combo * 24) % 360
    parts.burst(x, y, 60 + combo * 4, { speed: 520 + combo * 25, hue: () => hue + rand(-20, 20), life: 0.7, size: 4 })
    ring(x, y, 700 + combo * 30, 0.35, 6, hue)
    if (combo > 0 && combo % 8 === 0) {
      // chain bonus: every 8th fast tap is a mid-size boom at the tap
      stop.trigger(40)
      audio.boom(0.5)
      shake.add(0.5)
      flash.fire(0.4)
      haptic([20, 15, 60])
      parts.burst(x, y, 260, { speed: 1300, life: 1.1, size: 5 })
      ring(x, y, 1800, 0.6, 18, hue + 90)
      banner = { text: `×${combo} CHAIN`, t: 1, hue }
      track('tap_chain', { combo })
    }
  }

  const down = (e: PointerEvent) => {
    audio.unlock()
    if (first) {
      first = false
      onFirst()
    }
    canvas.setPointerCapture?.(e.pointerId)
    holding = true
    charge = 0
    px = e.clientX
    py = e.clientY
    riser?.stop()
    riser = audio.riser()
  }
  const up = () => {
    if (!holding) return
    holding = false
    riser?.stop()
    riser = null
    if (charge < TAP_THRESHOLD) tapBurst(px, py)
    else explode(charge)
    charge = 0
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  const update = (dt: number) => {
    time += dt
    if (holding) {
      charge = Math.min(1, charge + dt / FULL_TIME)
      riser?.set(charge)
      if (charge > TAP_THRESHOLD) {
        shake.trauma = Math.max(shake.trauma, 0.12 + 0.35 * charge * charge)
        if (Math.random() < charge * 0.25) haptic(8)
      }
      if (charge >= 1) {
        holding = false
        riser?.stop()
        riser = null
        explode(1)
        charge = 0
      }
    }
    coreScale += (1 - coreScale) * Math.min(1, dt * 3)
    const x0 = cx()
    const y0 = cy()
    const pull = holding ? 400 + 9000 * charge * charge : 0
    const coreR = minDim() * 0.06
    for (const d of dust) {
      const dx = x0 - d.x
      const dy = y0 - d.y
      const dist = Math.hypot(dx, dy) + 1
      if (pull) {
        d.vx += (dx / dist) * pull * dt
        d.vy += (dy / dist) * pull * dt
        // swirl
        d.vx += (-dy / dist) * pull * 0.3 * dt
        d.vy += (dx / dist) * pull * 0.3 * dt
      } else {
        // lazy orbit
        d.vx += (-dy / dist) * 20 * dt + (dx / dist) * 6 * dt
        d.vy += (dx / dist) * 20 * dt + (dy / dist) * 6 * dt
      }
      const drag = Math.pow(holding ? 0.97 : 0.985, dt * 60)
      d.vx *= drag
      d.vy *= drag
      d.x += d.vx * dt
      d.y += d.vy * dt
      if (holding && dist < coreR) {
        parts.spawn({ x: d.x, y: d.y, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.25, size: 3, hue: d.hue, light: 75 })
        spawnDust(d)
      } else if (d.x < -200 || d.y < -200 || d.x > stage.w + 200 || d.y > stage.h + 200) {
        spawnDust(d)
      }
    }
    parts.update(dt)
    for (const r of rings) {
      r.life -= dt
      r.r += r.v * dt
      r.v *= Math.pow(0.93, dt * 60)
    }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1)
    banner.t = Math.max(0, banner.t - dt * 0.9)
  }

  const draw = (now: number) => {
    const { ctx, w, h, dpr } = stage
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // trails
    ctx.fillStyle = 'rgba(5,5,14,0.32)'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    shake.apply(ctx, w, h, now)

    // dust
    ctx.globalCompositeOperation = 'lighter'
    for (const d of dust) {
      ctx.fillStyle = `hsla(${d.hue},90%,65%,0.8)`
      const sp = Math.min(20, Math.hypot(d.vx, d.vy) * 0.02)
      ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s + sp * 0.3, d.s + sp * 0.3)
    }
    ctx.globalCompositeOperation = 'source-over'

    // core
    const x = cx() + (holding ? rand(-1, 1) * 10 * charge * charge : 0)
    const y = cy() + (holding ? rand(-1, 1) * 10 * charge * charge : 0)
    const base = minDim() * 0.07 * coreScale
    const r = base * (1 + 0.35 * charge) + Math.sin(now * 0.004) * 2 * coreScale
    const hot = charge
    const hue = 200 - 200 * hot // cyan → red
    const glowR = r * (3 + 3 * hot)
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, glowR)
    g.addColorStop(0, `hsla(${hue},100%,70%,0.9)`)
    g.addColorStop(0.3, `hsla(${hue},100%,55%,0.35)`)
    g.addColorStop(1, `hsla(${hue},100%,50%,0)`)
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, glowR, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `hsl(${hue},100%,${80 + 15 * hot}%)`
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
    ctx.fill()
    // charge arc
    if (holding && charge > TAP_THRESHOLD) {
      ctx.strokeStyle = `hsla(${hue},100%,70%,0.9)`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x, y, r + 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge)
      ctx.stroke()
      // crackling arcs
      ctx.lineWidth = 1.5
      ctx.strokeStyle = `hsla(${hue + 40},100%,85%,${0.3 + 0.7 * charge})`
      for (let k = 0; k < Math.round(1 + charge * 6); k++) {
        let ax = x
        let ay = y
        const a = Math.random() * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        const len = r * (1.5 + 2.5 * charge)
        for (let s = 1; s <= 6; s++) {
          ax = x + Math.cos(a) * (len * s) / 6 + rand(-8, 8)
          ay = y + Math.sin(a) * (len * s) / 6 + rand(-8, 8)
          ctx.lineTo(ax, ay)
        }
        ctx.stroke()
      }
    }

    // rings
    ctx.globalCompositeOperation = 'lighter'
    for (const rg of rings) {
      const t = rg.life / rg.max
      ctx.strokeStyle = `hsla(${rg.hue},100%,70%,${t})`
      ctx.lineWidth = Math.max(0.5, rg.w * t)
      ctx.beginPath()
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
    parts.draw(ctx)

    if (banner.t > 0) {
      const s = 1 + (1 - banner.t) * 0.25
      ctx.save()
      ctx.translate(w / 2, h * 0.22)
      ctx.scale(s, s)
      ctx.globalAlpha = Math.min(1, banner.t * 2)
      ctx.font = `900 ${Math.round(minDim() * 0.11)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `hsl(${banner.hue},100%,70%)`
      ctx.fillText(banner.text, 4, 4)
      ctx.fillStyle = '#fff'
      ctx.fillText(banner.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()

    // red edge vignette while charging
    if (charge > TAP_THRESHOLD) {
      const v = ctx.createRadialGradient(w / 2, h / 2, minDim() * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6)
      const pulse = 0.75 + 0.25 * Math.sin(now * (0.01 + 0.04 * charge))
      v.addColorStop(0, 'rgba(255,0,40,0)')
      v.addColorStop(1, `rgba(255,20,40,${0.75 * charge * pulse})`)
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
    }
    flash.draw(ctx, w, h)
  }

  const stopLoop = runLoop((dt, now) => {
    if (!stop.active) {
      update(dt)
      shake.update(dt)
      flash.update(dt)
    }
    draw(now)
  })

  return () => {
    stopLoop()
    riser?.stop()
    dispose()
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
  }
}
