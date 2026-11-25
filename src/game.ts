import { audio, pentaFreq, type Riser } from './engine/AudioEngine'
import { track } from './analytics'
import { stats } from './share'
import { Flash, HitStop, Particles, Shake, haptic, rand, runLoop, setupCanvas } from './engine/juice'
import { Fish, newPose, poseBald, poseFor, rng } from './fish'

const FULL_TIME = 2.2 // seconds to reach critical
const TAP_THRESHOLD = 0.1 // below this charge a release counts as a tap

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  s: number
  px: number
  py: number
  col: string
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
  const q = new URLSearchParams(location.search)
  const DEV = import.meta.env.DEV
  const seed = Number(q.get('seed') ?? 1) || 1
  const rnd = q.has('seed') ? rng(seed) : Math.random
  const fish = new Fish(seed)
  const pose = newPose()
  const fixedC = DEV && q.has('c') ? Math.max(0, Math.min(1, Number(q.get('c')))) : null
  const fixedPose = DEV ? q.get('pose') : null
  let frozen = DEV && (fixedC !== null || fixedPose !== null)
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
  const cy = () => stage.h * 0.48
  const minDim = () => Math.min(stage.w, stage.h)
  const unit = () => minDim() * 0.105

  // baked sea: vertical gradient plus three faint light shafts from the top
  let sea: HTMLCanvasElement | null = null
  let seaKey = ''
  const bakeSea = () => {
    const key = `${stage.w}x${stage.h}@${stage.dpr}`
    if (key === seaKey && sea) return sea
    seaKey = key
    const c = sea ?? document.createElement('canvas')
    c.width = Math.round(stage.w * stage.dpr)
    c.height = Math.round(stage.h * stage.dpr)
    const g = c.getContext('2d')!
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0)
    const w = stage.w
    const h = stage.h
    const lg = g.createLinearGradient(0, 0, 0, h)
    lg.addColorStop(0, '#06202E')
    lg.addColorStop(1, '#020810')
    g.fillStyle = lg
    g.fillRect(0, 0, w, h)
    // shafts on their own layer: soft sides, then faded toward the bottom
    const L = document.createElement('canvas')
    L.width = c.width
    L.height = c.height
    const l = L.getContext('2d')!
    l.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0)
    const shaft = (x: number, width: number) => {
      l.save()
      l.translate(x, -20)
      l.rotate((12 * Math.PI) / 180)
      const xg = l.createLinearGradient(-width / 2, 0, width / 2, 0)
      xg.addColorStop(0, 'rgba(255,255,255,0)')
      xg.addColorStop(0.5, 'rgba(255,255,255,0.03)')
      xg.addColorStop(1, 'rgba(255,255,255,0)')
      l.fillStyle = xg
      l.fillRect(-width / 2, 0, width, h * 1.3)
      l.restore()
    }
    shaft(w * 0.2, w * 0.2)
    shaft(w * 0.5, w * 0.1)
    shaft(w * 0.76, w * 0.3)
    l.globalCompositeOperation = 'destination-in'
    const vf = l.createLinearGradient(0, 0, 0, h)
    vf.addColorStop(0, 'rgba(0,0,0,1)')
    vf.addColorStop(0.85, 'rgba(0,0,0,0)')
    l.fillStyle = vf
    l.fillRect(0, 0, w, h)
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'lighter'
    g.drawImage(L, 0, 0)
    g.globalCompositeOperation = 'source-over'
    sea = c
    return c
  }

  const spawnDust = (d?: Dust): Dust => {
    const a = rnd() * Math.PI * 2
    const r = Math.max(stage.w, stage.h) * (0.35 + rnd() * 0.4)
    const o = d ?? ({} as Dust)
    o.x = cx() + Math.cos(a) * r
    o.y = cy() + Math.sin(a) * r
    // gentle orbit
    const sp = 10 + rnd() * 30
    o.vx = -Math.sin(a) * sp
    o.vy = Math.cos(a) * sp
    o.hue = 190
    o.s = 0.6 + rnd() * 1.0
    const k = rnd()
    o.col = k < 0.7 ? '#9FE8FF' : k < 0.9 ? '#D6F6FF' : '#7CFFCB'
    o.px = o.x
    o.py = o.y
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
      stats.n = (stats.n ?? 0) + 1
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
      d.px = d.x
      d.py = d.y
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
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(bakeSea(), 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    shake.apply(ctx, w, h, now)

    // marine snow: round motes, each with a 1 px streak from where it was last frame
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1
    for (const d of dust) {
      ctx.fillStyle = d.col
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2)
      ctx.fill()
      const mx = d.x - d.px
      const my = d.y - d.py
      if (mx * mx + my * my > 4) {
        ctx.strokeStyle = d.col
        ctx.beginPath()
        ctx.moveTo(d.px, d.py)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // the fish
    if (fixedPose === 'bald') poseBald(pose)
    else if (fixedC !== null) poseFor(pose, fixedC, fixedC > 0, fish.delay)
    else poseFor(pose, charge, holding, fish.delay)
    pose.x = cx()
    pose.y = cy()
    pose.angerPulse = now * 0.001 * Math.PI * 2 * 4
    fish.draw(ctx, pose, unit(), dpr, frozen ? 0 : now / 1000)

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

  let simNow = performance.now()
  if (DEV) {
    ;(window as unknown as Record<string, unknown>).__toy = {
      seed,
      ready: true,
      freeze: () => (frozen = true),
      resume: () => (frozen = false),
      advance: (dt: number) => {
        update(dt)
        shake.update(dt)
        flash.update(dt)
        simNow += dt * 1000
        draw(simNow)
      },
      U: () => unit(),
      center: () => [cx(), cy()],
    }
  }

  const stopLoop = runLoop((dt, now) => {
    if (frozen) {
      draw(simNow)
      return
    }
    simNow = now
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
