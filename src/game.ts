import { audio, pentaFreq, type Riser } from './engine/AudioEngine'
import { track } from './analytics'
import { stats } from './share'
import { chargePfft, locale, t } from './i18n'
import { Shake, haptic, runLoop, setupCanvas } from './engine/juice'
import { Fish, GULPS, N_SPINES, newPose, poseBald, poseFor, rng, scaleForGulps } from './fish'
import { Sea } from './scene'

const FULL_TIME = 2.2 // seconds to blow up
const TAP_THRESHOLD = 0.1 // below this a release is a tap (or a poke if it lands on the fish)
const FONT = locale === 'ja' ? 'system-ui, "Hiragino Sans", "Noto Sans CJK JP", sans-serif' : 'system-ui, "PingFang SC", "Hiragino Sans", "Noto Sans CJK SC", sans-serif'
const SNOW = ['#9FE8FF', '#D6F6FF', '#7CFFCB']
const BUB = ['214,246,255', '159,232,255', '255,243,208']

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  px: number
  py: number
  s: number
  col: number
  age: number
  suck: number
}

interface Bubble {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  col: number
  grav: number
  drag: number
  ph: number
}

interface Ring {
  x: number
  y: number
  r: number
  v: number
  life: number
  max: number
  w: number
  col: string
}

interface Needle {
  x: number
  y: number
  dx: number
  dy: number
  v: number
  stuck: number // -1 while flying, else seconds since it stuck
  hx: number[]
  hy: number[]
}

interface Line {
  text: string
  x: number
  y: number
  age: number
  dur: number
  rise: number
  size: number
}

type Mode = 'idle' | 'hold' | 'pfft' | 'pause' | 'return' | 'bald'

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt))

export function startGame(canvas: HTMLCanvasElement, onFirst: () => void): () => void {
  const { stage, dispose } = setupCanvas(canvas)
  const q = new URLSearchParams(location.search)
  const DEV = import.meta.env.DEV
  const seed = Number(q.get('seed') ?? 1) || 1
  const rnd = q.has('seed') ? rng(seed) : Math.random
  const rr = (a: number, b: number) => a + rnd() * (b - a)
  const fish = new Fish(seed)
  const sea = new Sea(seed)
  const pose = newPose()
  const tgt = newPose()
  const fixedC = q.get('og') === '1' ? 0.9 : DEV && q.has('c') ? Math.max(0, Math.min(1, Number(q.get('c')))) : null
  const fixedPose = DEV ? q.get('pose') : null
  const isStatic = fixedC !== null || fixedPose === 'bald'
  let frozen = DEV && isStatic

  const shake = new Shake(34, 0.06, 1.4)
  const motes: Mote[] = []
  const bubbles: Bubble[] = []
  const rings: Ring[] = []
  const needles: Needle[] = []
  const lines: Line[] = []

  let time = 0
  let stopT = 0 // hit-stop, sim seconds
  let pendingBlew = false
  let mode: Mode = 'idle'
  let modeT = 0
  let holding = false
  let tapOnly = false
  let charge = 0
  let gulpCount = 0
  let riser: Riser | null = null
  let lastTap = -9
  let combo = 0
  let px = 0
  let py = 0
  let downOnFish = false
  let first = true
  let firstPfft = true
  let firstPoke = true
  let banner = { text: '', t: 0, shadow: '#E8452C' }
  let bloom = { a: 0, peak: 0, x: 0, y: 0 }
  // fish motion
  let fx = 0
  let fy = 0
  let sV = 0
  let sTarget = 1
  let sqxV = 0
  let sqyV = 0
  let mouthT = 0
  let startleT = 0
  let glareT = 0
  let puffT = 0
  let blinkIn = 3
  let blinkT = 0
  let blinkQueue: number[] = []
  let sleepyBubbleIn = 2
  let leakIn = 0
  let trailIn = 0
  let balded = 0
  let regrowOrder: number[] = []
  let baldLine = false
  // pfft flight
  let fl = { T: 0, v: 0, th: 0, w: 0, wT: 0, wIn: 0, s0: 1, c: 0, sx: 0, sy: 0 }

  const minDim = () => Math.min(stage.w, stage.h)
  // rest radius: the fish is ~45 % of the phone width at rest; on wide screens it follows the height
  const OG = q.get('og') === '1'
  const unit = () => (OG ? stage.h * 0.15 : Math.min(stage.w * 0.2083, stage.h * 0.1))
  const homeX = () => stage.w / 2
  const homeY = () => stage.h * (OG ? 0.47 : 0.44)
  fx = homeX()
  fy = homeY()

  // ---------- marine snow ----------
  const spawnMote = (m?: Mote): Mote => {
    const o = m ?? ({} as Mote)
    const U = unit()
    for (let k = 0; k < 8; k++) {
      o.x = rnd() * stage.w
      o.y = rnd() * stage.h
      if (Math.hypot(o.x - fx, o.y - fy) > U * 2.4) break
    }
    o.vx = rr(-8, 8)
    o.vy = rr(2, 12)
    o.s = 0.6 + rnd()
    const k = rnd()
    o.col = k < 0.7 ? 0 : k < 0.9 ? 1 : 2
    o.px = o.x
    o.py = o.y
    o.age = 0
    o.suck = 0
    return o
  }
  for (let i = 0; i < 380; i++) motes.push(spawnMote())

  // ---------- bubbles (replace the additive squares) ----------
  const bubble = (x: number, y: number, vx: number, vy: number, life: number, r: number, grav = -300, drag = 0.955) => {
    if (bubbles.length >= 2400) bubbles.shift()
    const k = rnd()
    bubbles.push({ x, y, vx, vy, life, max: life, r, col: k < 0.5 ? 0 : k < 0.85 ? 1 : 2, grav, drag, ph: rnd() * 6.28 })
  }
  /** Bubbles bursting outward; `skin` > 0 spawns them on a circle of that radius (the fish's skin) so they never pile up over its face. */
  const burst = (x: number, y: number, n: number, speed: number, life: number, r0 = 2, r1 = 7, skin = 0) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const sp = speed * (0.2 + rnd() * 0.9)
      const o = skin * (0.85 + rnd() * 0.25)
      bubble(x + Math.cos(a) * o, y + Math.sin(a) * o, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.5 + rnd() * 0.7), rr(r0, r1))
    }
  }
  const ring = (x: number, y: number, v: number, life: number, w: number, col: string) => rings.push({ x, y, r: 4, v, life, max: life, w, col })
  const fireBloom = (peak: number) => (bloom = { a: peak, peak, x: fx, y: fy })
  const floatLine = (text: string, x: number, y: number, dur: number, rise: number, size: number) => lines.push({ text, x, y, age: 0, dur, rise, size })

  const blastMotes = (power: number) => {
    for (const d of motes) {
      const dx = d.x - fx
      const dy = d.y - fy
      const dist = Math.hypot(dx, dy) + 1
      const f = (2600 * power) / Math.sqrt(dist)
      d.vx += (dx / dist) * f * 10
      d.vy += (dy / dist) * f * 10
    }
  }

  // ---------- events ----------
  const gulp = () => {
    gulpCount++
    sTarget = scaleForGulps(gulpCount)
    mouthT = 0.09
    audio.gulp(gulpCount)
    haptic(8)
    // the 30 nearest motes get sucked to the mouth
    const [mx, my] = fish.mouthWorld(pose, unit())
    const near = motes
      .map((m, i) => [Math.hypot(m.x - mx, m.y - my), i] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 30)
    for (const [, i] of near) motes[i].suck = 0.35
  }

  const blast = (c: number) => {
    stopT = (30 + 20 * c) / 1000
    shake.maxPx = 34
    shake.add(0.35 + 0.55 * c)
    fireBloom(0.3)
    audio.boom(0.35 + 0.65 * c)
    haptic([25, 15, 60])
    const n = Math.round(120 + 380 * c)
    burst(fx, fy, n, 500 + 1500 * c, 1.1, 2, 7, pose.s * unit())
    rings.push({ x: fx, y: fy, r: pose.s * unit(), v: 1600 * (0.5 + c), life: 0.6, max: 0.6, w: 12, col: '#D6F6FF' })
    pose.anger = 0
    pose.sweat = 0
    blastMotes(c)
    // spits everything out: recoil small, spring back
    pose.s = 0.8
    sV = 0
    sTarget = 1
    startleT = 0.45
    mode = 'idle'
    modeT = 0
  }

  const doBlew = () => {
    const U = unit()
    for (let i = 0; i < N_SPINES; i++) {
      const s = fish.spineWorld(pose, U, i)
      needles.push({ x: s.x, y: s.y, dx: s.dx, dy: s.dy, v: rr(1800, 2600), stuck: -1, hx: [s.x, s.x, s.x], hy: [s.y, s.y, s.y] })
    }
    shake.maxPx = 34
    shake.add(1)
    fireBloom(0.55)
    audio.boom(1)
    audio.chord([pentaFreq(10, 110), pentaFreq(12, 110), pentaFreq(14, 110), pentaFreq(15, 110)], 1.6, 0.12, 0.02)
    haptic([30, 20, 80, 40, 140])
    burst(fx, fy, 520, 2000, 1.2, 2, 7, pose.s * unit())
    ring(fx, fy, 2400, 0.7, 30, '#D6F6FF')
    ring(fx, fy, 1300, 0.5, 14, '#9FE8FF')
    ring(fx, fy, 2600, 0.5, 14, '#FFF3D0')
    blastMotes(1)
    banner = { text: t('charge_blew'), t: 1, shadow: '#E8452C' }
    track('critical')
    stats.n = (stats.n ?? 0) + 1
    // bald
    pose.s = 0.75
    sV = 0
    sTarget = 0.75
    pose.spine.fill(0)
    pose.spineOn.fill(0)
    pose.red = 0
    pose.anger = 0
    pose.sweat = 0
    pose.blush = 0
    pose.dots = 1
    pose.sat = 0.85
    mode = 'bald'
    modeT = 0
    balded = 0
    regrowOrder = Array.from({ length: N_SPINES }, (_, i) => i)
    for (let i = regrowOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[regrowOrder[i], regrowOrder[j]] = [regrowOrder[j], regrowOrder[i]]
    }
    baldLine = rnd() < 1 / 3
    bubble(fx, fy - pose.s * U, rr(-10, 10), -40, 2.2, 5, -30, 0.99)
  }

  const startPfft = (c: number) => {
    const T = 0.5 + 0.8 * c
    fl = { T, v: (1100 + 1500 * c) * (unit() / 86), th: -Math.PI / 2 + rr(-1.2, 1.2), w: 0, wT: rr(-9, 9), wIn: 0.08, s0: pose.s, c, sx: 0, sy: 0 }
    audio.raspberry(c, T)
    haptic([10, 30, 10, 30, 10, 40, 10])
    shake.maxPx = 34
    shake.add(0.1)
    mode = 'pfft'
    modeT = 0
    if (firstPfft) {
      firstPfft = false
      track('pfft', { c10: Math.max(1, Math.min(4, Math.round(c * 10))) })
    }
  }

  const poke = () => {
    pose.sqx = 1.12
    pose.sqy = 0.9
    sqxV = sqyV = 0
    puffT = 0.3
    glareT = 0.6
    startleT = 0
    if (firstPoke) {
      firstPoke = false
      track('poke')
    }
  }

  /** A quick tap. On the fish it is a poke (squash and glare); either way it counts toward the chain. */
  const tapBurst = (x: number, y: number, onFish: boolean) => {
    combo = time - lastTap < 0.6 ? combo + 1 : 0
    lastTap = time
    audio.blip(pentaFreq(combo % 15, 220), onFish ? 0.2 : 0.3)
    shake.maxPx = 34
    shake.add((onFish ? 0.12 : 0.22) + Math.min(0.25, combo * 0.02))
    haptic(onFish ? 12 : 18)
    if (onFish) {
      poke()
      burst(x, y, 12 + combo * 2, 260 + combo * 15, 0.6, 2, 4)
    } else {
      burst(x, y, 60 + combo * 4, 520 + combo * 25, 0.7, 2, 5)
      ring(x, y, 700 + combo * 30, 0.35, 6, '#9FE8FF')
    }
    if (combo > 0 && combo % 8 === 0) {
      stopT = 0.04
      audio.boom(0.5)
      shake.add(0.5)
      haptic([20, 15, 60])
      burst(x, y, 260, 1300, 1.1)
      ring(x, y, 1800, 0.6, 18, '#D6F6FF')
      banner = { text: `×${combo} CHAIN`, t: 1, shadow: '#1B6F8F' }
      track('tap_chain', { combo })
    }
  }

  // ---------- input ----------
  const press = (x: number, y: number) => {
    audio.unlock()
    if (first) {
      first = false
      onFirst()
    }
    px = x
    py = y
    downOnFish = fish.hit(pose, unit(), x, y)
    holding = true
    charge = 0
    tapOnly = !(mode === 'idle' || mode === 'return')
    if (tapOnly) return
    mode = 'hold'
    modeT = 0
    gulpCount = 0
    sTarget = Math.max(1, sTarget)
    startleT = 0
    glareT = 0
    const [mx, my] = fish.mouthWorld(pose, unit())
    bubble(mx, my, rr(-10, 10), -60, 1.4, 4, -80, 0.985)
    riser?.stop()
    riser = audio.riser()
  }
  const release = () => {
    if (!holding) return
    holding = false
    riser?.stop()
    riser = null
    const c = charge
    charge = 0
    if (tapOnly || c < TAP_THRESHOLD) {
      if (mode === 'hold') {
        mode = 'idle'
        sTarget = 1
      }
      tapBurst(px, py, downOnFish && mode === 'idle')
      return
    }
    if (c < 0.5) startPfft(c)
    else blast(c)
  }
  const down = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId)
    press(e.clientX, e.clientY)
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // ---------- simulation ----------
  const faceTarget = () => {
    switch (mode) {
      case 'hold':
        poseFor(tgt, charge, true, fish.delay)
        break
      case 'pfft':
        poseFor(tgt, 0.05, true)
        tgt.mouthOpen = 1
        tgt.pupil = 0.55
        break
      case 'pause':
      case 'return':
        poseFor(tgt, 0, false)
        tgt.lidOpen = 0.58
        tgt.lookY = 0.1
        tgt.mouthFlat = 1
        break
      case 'bald':
        poseBald(tgt)
        break
      default:
        if (startleT > 0) poseFor(tgt, 0.05, true)
        else if (glareT > 0) {
          poseFor(tgt, 0.2, true)
          const dx = px - fx
          const dy = py - fy
          const d = Math.hypot(dx, dy) + 1
          tgt.lookX = dx / d
          tgt.lookY = dy / d
          tgt.lidOpen = 0.78
        } else poseFor(tgt, 0, false)
    }
  }

  const update = (dt: number) => {
    time += dt
    modeT += dt
    const U = unit()
    const w = stage.w
    const h = stage.h

    if (holding && !tapOnly && mode === 'hold') {
      charge = Math.min(1, charge + dt / FULL_TIME)
      riser?.set(charge)
      while (gulpCount < GULPS.length && charge >= GULPS[gulpCount]) gulp()
      if (charge > TAP_THRESHOLD) {
        shake.maxPx = 12
        shake.trauma = Math.max(shake.trauma, 0.12 + 0.35 * charge * charge)
        if (rnd() < charge * 0.25) haptic(8)
      }
      if (charge >= 0.45 && charge < 0.8) {
        leakIn -= dt
        if (leakIn <= 0) {
          leakIn = 0.25
          const [mx, my] = fish.mouthWorld(pose, U)
          const side = rnd() < 0.5 ? -1 : 1
          bubble(mx + side * 0.09 * U * Math.sqrt(pose.s), my, side * 30, -20, 1.2, rr(2, 3.5), -90, 0.985)
        }
      }
      if (charge >= 1) {
        // freeze on the fullest, angriest frame, then blow
        holding = false
        riser?.stop()
        riser = null
        charge = 1
        stopT = 0.06
        pendingBlew = true
        return
      }
    }

    // timers
    startleT = Math.max(0, startleT - dt)
    glareT = Math.max(0, glareT - dt)
    puffT = Math.max(0, puffT - dt)
    mouthT = Math.max(0, mouthT - dt)

    // ---- mode motion
    let bobY = 0
    let rot = 0
    if (mode === 'pfft') {
      const k = Math.min(1, modeT / fl.T)
      fl.wIn -= dt
      if (fl.wIn <= 0) {
        fl.wIn = 0.08
        fl.wT = rr(-9, 9)
      }
      fl.w = approach(fl.w, fl.wT, 20, dt)
      fl.th += fl.w * dt
      // thrust while the air lasts, then coast
      const v = fl.v * Math.pow(1 - k, 0.6)
      fx += Math.cos(fl.th) * v * dt
      fy += Math.sin(fl.th) * v * dt
      pose.s = fl.s0 + (0.85 - fl.s0) * (1 - (1 - k) * (1 - k))
      sV = 0
      // the 12 % stretch and the wobble can push past the plain extent
      const ext = fish.extent(pose, U)
      const ex = ext.ex * 1.14
      const ey = ext.ey * 1.14
      const loX = Math.min(ex, w / 2)
      const hiX = Math.max(w - ex, w / 2)
      const loY = Math.min(ey, h / 2)
      const hiY = Math.max(h - ey, h / 2)
      if (fx < loX || fx > hiX) {
        fx = Math.max(loX, Math.min(hiX, fx))
        fl.th = Math.PI - fl.th
      }
      if (fy < loY || fy > hiY) {
        fy = Math.max(loY, Math.min(hiY, fy))
        fl.th = -fl.th
      }
      pose.stretch = 0.12 * Math.min(1, v / 500)
      pose.stretchAng = fl.th
      rot = Math.sin(time * 9) * 0.12 * Math.min(1, v / 400)
      // bubble trail out of the mouth, behind the direction of travel
      trailIn -= dt
      while (trailIn <= 0) {
        trailIn += 1 / 60
        const bx = fx - Math.cos(fl.th) * pose.s * U * 0.8
        const by = fy - Math.sin(fl.th) * pose.s * U * 0.8
        bubble(bx + rr(-4, 4), by + rr(-4, 4), -Math.cos(fl.th) * 160 + rr(-30, 30), -Math.sin(fl.th) * 160 + rr(-30, 30), rr(0.5, 0.9), rr(2, 5), -200, 0.94)
      }
      if (k >= 1) {
        mode = 'pause'
        modeT = 0
        sTarget = 0.85
        blinkQueue = [0.12, 0.42]
        fl.sx = fx
        fl.sy = fy
        const words = chargePfft()
        floatLine(words[Math.floor(rnd() * words.length)], fx, fy - fish.extent(pose, U).ey - 0.05 * U, 0.9, 0.6 * U, 0.22 * U)
      }
    } else {
      pose.stretch = approach(pose.stretch, 0, 14, dt)
    }
    if (mode === 'pause') {
      for (let i = blinkQueue.length - 1; i >= 0; i--)
        if (modeT >= blinkQueue[i]) {
          blinkT = 0.12
          blinkQueue.splice(i, 1)
        }
      if (modeT >= 0.65) {
        mode = 'return'
        modeT = 0
        sTarget = 1
      }
    } else if (mode === 'return') {
      const k = easeInOut(Math.min(1, modeT / 1.2))
      fx = fl.sx + (homeX() - fl.sx) * k
      fy = fl.sy + (homeY() - fl.sy) * k
      rot = Math.sin(modeT * 7) * 0.08 * (1 - k)
      if (modeT >= 1.2) {
        mode = 'idle'
        modeT = 0
      }
    } else if (mode !== 'pfft') {
      fx = approach(fx, homeX(), 6, dt)
      fy = approach(fy, homeY(), 6, dt)
    }
    if (mode === 'idle' || mode === 'return') {
      bobY = Math.sin(time * Math.PI) * 0.04 * U
      rot += Math.sin(time * 0.8) * 0.05
    }
    if (mode === 'hold' && charge >= 0.8) {
      // trembling with rage
      fx += Math.sin(time * 2 * Math.PI * 30) * 0.02 * U
      bobY = Math.cos(time * 2 * Math.PI * 27) * 0.02 * U
    }
    if (mode === 'bald') {
      rot = Math.sin(modeT * 2.6) * 0.14 * Math.max(0, 1 - modeT / 2.4)
      // spines grow back one by one, each with a tick
      const n = Math.floor(Math.max(0, Math.min(1, (modeT - 0.9) / 0.8)) * N_SPINES + 1e-6)
      while (balded < n) {
        const i = regrowOrder[balded++]
        pose.spineOn[i] = 1
        pose.spine[i] = 0.55 // sproing out, then lie back down
        audio.tik(0.04)
      }
      if (baldLine && modeT >= 1.0) {
        baldLine = false
        floatLine(t('charge_bald'), fx, fy + fish.extent(pose, U).ey + 0.3 * U, 2.2, 0.15 * U, 0.2 * U)
      }
      if (modeT >= 1.75) sTarget = 1
      if (modeT >= 2.0) {
        mode = 'idle'
        modeT = 0
      }
    }

    // ---- idle life: blinks and sleepy bubbles
    const sleepy = mode === 'idle' && startleT <= 0 && glareT <= 0
    if (sleepy) {
      blinkIn -= dt
      if (blinkIn <= 0) {
        blinkIn = rr(3, 5)
        blinkT = 0.12
      }
      sleepyBubbleIn -= dt
      if (sleepyBubbleIn <= 0) {
        sleepyBubbleIn = rr(1.6, 3.2)
        const [mx, my] = fish.mouthWorld(pose, U)
        bubble(mx, my - 2, rr(-6, 6), -25, 3, rr(2.5, 4.5), -35, 0.99)
        if (rnd() < 0.5) bubble(mx + 2, my - 4, rr(-6, 6), -20, 3, rr(1.5, 2.5), -35, 0.99)
      }
    }
    blinkT = Math.max(0, blinkT - dt)

    // ---- scale and squash springs
    const sGoal = mode === 'hold' ? sTarget : sTarget + (puffT > 0 ? 0.08 : 0)
    if (mode !== 'pfft') {
      sV += (220 * (sGoal - pose.s) - 14 * sV) * dt
      pose.s += sV * dt
    }
    sqxV += (300 * (1 - pose.sqx) - 12 * sqxV) * dt
    sqyV += (300 * (1 - pose.sqy) - 12 * sqyV) * dt
    pose.sqx += sqxV * dt
    pose.sqy += sqyV * dt

    // ---- face and skin follow their targets
    faceTarget()
    pose.lidOpen = approach(pose.lidOpen, tgt.lidOpen, 35, dt)
    pose.lidTilt = approach(pose.lidTilt, tgt.lidTilt, 20, dt)
    pose.pupil = approach(pose.pupil, tgt.pupil, 25, dt)
    pose.lookX = approach(pose.lookX, tgt.lookX, 12, dt)
    pose.lookY = approach(pose.lookY, tgt.lookY, 12, dt)
    pose.mouthFlat = approach(pose.mouthFlat, tgt.mouthFlat, 20, dt)
    pose.mouthOpen = approach(pose.mouthOpen, mouthT > 0 ? 1 : tgt.mouthOpen, 45, dt)
    pose.anger = approach(pose.anger, tgt.anger, 12, dt)
    pose.sweat = approach(pose.sweat, tgt.sweat, 10, dt)
    pose.red = approach(pose.red, tgt.red, 6, dt)
    pose.blush = approach(pose.blush, tgt.blush, 6, dt)
    pose.sat = approach(pose.sat, tgt.sat, 3, dt)
    pose.dots = tgt.dots
    for (let i = 0; i < N_SPINES; i++) {
      pose.spine[i] = approach(pose.spine[i], tgt.spine[i], mode === 'hold' ? 25 : 7, dt)
      if (mode !== 'bald') pose.spineOn[i] = approach(pose.spineOn[i], 1, 10, dt)
    }
    pose.x = fx
    pose.y = fy + bobY
    pose.rot = rot

    // ---- marine snow
    const pull = mode === 'hold' ? 300 + 4500 * charge * charge : 0
    const [mx, my] = fish.mouthWorld(pose, U)
    const bodyR = pose.s * U * 0.95
    for (const d of motes) {
      d.age += dt
      const dx = fx - d.x
      const dy = fy - d.y
      const dist = Math.hypot(dx, dy) + 1
      if (d.suck > 0) {
        d.suck -= dt
        const sx = mx - d.x
        const sy = my - d.y
        const sd = Math.hypot(sx, sy) + 1
        d.vx += (sx / sd) * 9000 * dt
        d.vy += (sy / sd) * 9000 * dt
        if (sd < 0.1 * U) {
          spawnMote(d)
          continue
        }
      } else if (pull) {
        d.vx += (dx / dist) * pull * dt + (-dy / dist) * pull * 0.3 * dt
        d.vy += (dy / dist) * pull * dt + (dx / dist) * pull * 0.3 * dt
      } else {
        // drifting and slowly sinking
        d.vx += Math.sin(time * 0.4 + d.y * 0.01) * 3 * dt
        d.vy += (6 - d.vy) * 0.5 * dt
      }
      const drag = Math.pow(pull || d.suck > 0 ? 0.97 : 0.985, dt * 60)
      d.vx *= drag
      d.vy *= drag
      d.px = d.x
      d.py = d.y
      d.x += d.vx * dt
      d.y += d.vy * dt
      if ((pull && dist < bodyR) || d.x < -60 || d.y < -60 || d.x > w + 60 || d.y > h + 60) spawnMote(d)
    }

    // ---- bubbles
    const k60 = dt * 60
    let j = 0
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i]
      b.life -= dt
      if (b.life <= 0 || b.y < -20) continue
      const dg = Math.pow(b.drag, k60)
      b.vx *= dg
      b.vy = b.vy * dg + b.grav * dt
      b.x += (b.vx + Math.sin(time * 7 + b.ph) * 12) * dt
      b.y += b.vy * dt
      bubbles[j++] = b
    }
    bubbles.length = j

    // ---- needles
    for (let i = needles.length - 1; i >= 0; i--) {
      const n = needles[i]
      if (n.stuck < 0) {
        n.hx.unshift(n.x)
        n.hy.unshift(n.y)
        n.hx.length = n.hy.length = 3
        n.x += n.dx * n.v * dt
        n.y += n.dy * n.v * dt
        const sink = 0.06 * U
        if (n.x <= -sink || n.x >= w + sink || n.y <= -sink || n.y >= h + sink) {
          // stick in the edge of the screen, tip buried a little
          n.x = Math.max(-sink, Math.min(w + sink, n.x))
          n.y = Math.max(-sink, Math.min(h + sink, n.y))
          n.stuck = 0
          audio.tik(0.05)
        }
      } else {
        n.stuck += dt
        if (n.stuck > 1.5) needles.splice(i, 1)
      }
    }

    for (const r of rings) {
      r.life -= dt
      r.r += r.v * dt
      r.v *= Math.pow(0.93, k60)
    }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1)
    for (let i = lines.length - 1; i >= 0; i--) if ((lines[i].age += dt) > lines[i].dur) lines.splice(i, 1)
    banner.t = Math.max(0, banner.t - dt * 0.9)
    bloom.a = Math.max(0, bloom.a - (bloom.peak / 0.12) * dt)
  }

  // ---------- drawing ----------
  const bubblePaths = Array.from({ length: 12 }, () => new Path2D())
  const drawBubbles = (ctx: CanvasRenderingContext2D) => {
    for (let i = 0; i < 12; i++) bubblePaths[i] = new Path2D()
    const hi = new Path2D()
    for (const b of bubbles) {
      const t = b.life / b.max
      const ab = Math.min(3, Math.floor(Math.min(1, t * 1.5) * 4))
      const r = b.r * (0.6 + 0.4 * Math.min(1, t * 2))
      const p = bubblePaths[b.col * 4 + ab]
      p.moveTo(b.x + r, b.y)
      p.arc(b.x, b.y, r, 0, Math.PI * 2)
      if (r >= 2.5) {
        hi.moveTo(b.x - r * 0.35, b.y - r * 0.35)
        hi.arc(b.x - r * 0.35, b.y - r * 0.35, Math.max(0.6, r * 0.2), 0, Math.PI * 2)
      }
    }
    ctx.lineWidth = 1
    for (let c = 0; c < 3; c++)
      for (let a = 0; a < 4; a++) {
        ctx.strokeStyle = `rgba(${BUB[c]},${0.8 * ((a + 1) / 4)})`
        ctx.stroke(bubblePaths[c * 4 + a])
      }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fill(hi)
  }

  const snowPaths = [new Path2D(), new Path2D(), new Path2D()]
  const drawSnow = (ctx: CanvasRenderingContext2D) => {
    for (let i = 0; i < 3; i++) snowPaths[i] = new Path2D()
    const streak = new Path2D()
    for (const d of motes) {
      const p = snowPaths[d.col]
      p.moveTo(d.x + d.s, d.y)
      p.arc(d.x, d.y, d.s, 0, Math.PI * 2)
      const mx = d.x - d.px
      const my = d.y - d.py
      if (mx * mx + my * my > 9) {
        streak.moveTo(d.px, d.py)
        streak.lineTo(d.x, d.y)
      }
    }
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = SNOW[i]
      ctx.fill(snowPaths[i])
    }
    ctx.globalAlpha = 0.22
    ctx.strokeStyle = SNOW[0]
    ctx.lineWidth = 1
    ctx.stroke(streak)
    ctx.globalAlpha = 1
  }

  const drawNeedles = (ctx: CanvasRenderingContext2D, U: number) => {
    const L = 0.3 * U
    const hb = 0.03 * U
    for (const n of needles) {
      let ang = Math.atan2(n.dy, n.dx)
      let alpha = 1
      if (n.stuck >= 0) {
        if (n.stuck < 0.3) ang += ((14 * Math.PI) / 180) * Math.exp(-n.stuck / 0.09) * Math.sin(n.stuck * 2 * Math.PI * 16)
        if (n.stuck > 1.2) alpha = Math.max(0, 1 - (n.stuck - 1.2) / 0.3)
      } else {
        // three-segment tail along the path just flown
        ctx.strokeStyle = 'rgba(255,243,208,0.3)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        // the tail is at most 0.6U, so it reads as speed, not as a scratch
        const tx = n.x - n.dx * L
        const ty = n.y - n.dy * L
        ctx.moveTo(tx, ty)
        for (let k = 0; k < 3; k++) {
          const d = Math.min(Math.hypot(n.hx[k] - n.x, n.hy[k] - n.y), 0.6 * U * ((k + 1) / 3))
          ctx.lineTo(tx - n.dx * d, ty - n.dy * d)
        }
        ctx.stroke()
      }
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(n.x, n.y)
      ctx.rotate(ang)
      ctx.fillStyle = '#FFF3D0'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-L, -hb)
      ctx.lineTo(-L, hb)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#B8923C'
      ctx.beginPath()
      ctx.moveTo(-L * 0.7, -hb * 0.7)
      ctx.lineTo(-L, -hb)
      ctx.lineTo(-L, hb)
      ctx.lineTo(-L * 0.7, hb * 0.7)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  const fitFont = (ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) => {
    ctx.font = `${weight} ${size}px ${FONT}`
    const m = ctx.measureText(text).width
    if (m > maxW) {
      size = Math.floor((size * maxW) / m)
      ctx.font = `${weight} ${size}px ${FONT}`
    }
    return size
  }

  const draw = (nowMs: number) => {
    const { ctx, w, h, dpr } = stage
    const U = unit()
    sea.drawBack(ctx, w, h, dpr)
    sea.drawWeed(ctx, time, fx, mode === 'hold' ? charge : 0)
    ctx.save()
    shake.apply(ctx, w, h, nowMs)
    drawSnow(ctx)

    if (isStatic) {
      if (fixedPose === 'bald') poseBald(pose)
      else poseFor(pose, fixedC!, fixedC! > 0, fish.delay)
      pose.x = homeX()
      pose.y = homeY()
    }
    pose.angerPulse = time * Math.PI * 2 * 4
    const lid = pose.lidOpen
    if (blinkT > 0) pose.lidOpen = lid * (1 - Math.sin((1 - blinkT / 0.12) * Math.PI))
    fish.draw(ctx, pose, U, dpr, time)
    pose.lidOpen = lid

    for (const rg of rings) {
      const k = rg.life / rg.max
      ctx.globalAlpha = k * k * 0.7
      ctx.strokeStyle = rg.col
      ctx.lineWidth = Math.max(0.5, rg.w * k * 0.35)
      ctx.beginPath()
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    drawBubbles(ctx)
    ctx.restore()

    drawNeedles(ctx, U)

    // floating lines (pfft, bald)
    for (const l of lines) {
      const k = l.age / l.dur
      ctx.globalAlpha = 0.85 * Math.min(1, k * 6) * Math.min(1, (1 - k) * 4)
      fitFont(ctx, l.text, 600, Math.round(l.size), w * 0.9)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#D6F6FF'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 6
      ctx.fillText(l.text, l.x, l.y - l.rise * easeInOut(Math.min(1, k * 1.2)))
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1

    // radial bloom from the fish (replaces the full-screen white flash)
    if (bloom.a > 0.01) {
      const R = 0.9 * Math.max(w, h)
      const g = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, R)
      g.addColorStop(0, `rgba(255,255,255,${bloom.a})`)
      g.addColorStop(0.25, `rgba(214,246,255,${bloom.a * 0.45})`)
      g.addColorStop(1, 'rgba(214,246,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    if (banner.t > 0) {
      const s = 1 + (1 - banner.t) * 0.25
      ctx.save()
      ctx.translate(w / 2, h * 0.16)
      ctx.scale(s, s)
      ctx.globalAlpha = Math.min(1, banner.t * 2)
      fitFont(ctx, banner.text, 900, Math.round(minDim() * 0.11), w * 0.86)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = banner.shadow
      ctx.fillText(banner.text, 4, 4)
      ctx.fillStyle = '#fff'
      ctx.fillText(banner.text, 0, 0)
      ctx.restore()
    }

    // red edge vignette while charging; never reaches the fish
    const vc = mode === 'hold' ? charge : isStatic && fixedC ? fixedC : 0
    if (vc > TAP_THRESHOLD) {
      const v = ctx.createRadialGradient(w / 2, h / 2, minDim() * 0.5, w / 2, h / 2, Math.hypot(w, h) * 0.6)
      const pulse = 0.75 + 0.25 * Math.sin(time * (10 + 40 * vc))
      v.addColorStop(0, 'rgba(200,30,40,0)')
      v.addColorStop(1, `rgba(200,30,40,${0.35 * vc * pulse})`)
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
    }
  }

  const step = (dt: number) => {
    if (stopT > 0) {
      stopT -= dt
      if (stopT <= 0 && pendingBlew) {
        pendingBlew = false
        charge = 0
        doBlew()
      }
      return
    }
    update(dt)
    shake.update(dt)
  }

  let simNow = 0
  if (DEV) {
    ;(window as unknown as Record<string, unknown>).__toy = {
      seed,
      ready: true,
      spines: fish.spines.length,
      freeze: () => (frozen = true),
      resume: () => (frozen = false),
      advance: (dt: number) => {
        step(dt)
        simNow += dt * 1000
        draw(simNow)
      },
      setCharge: (c: number) => {
        if (mode !== 'hold') press(homeX(), homeY())
        charge = c
        while (gulpCount < GULPS.length && charge >= GULPS[gulpCount]) gulp()
      },
      press: (x?: number, y?: number) => press(x ?? homeX(), y ?? homeY()),
      release,
      state: () => ({ mode, modeT, charge, s: pose.s, x: fx, y: fy, needles: needles.length, stuck: needles.filter((n) => n.stuck >= 0).length, spinesOn: Array.from(pose.spineOn).filter((v) => v > 0.5).length }),
      U: () => unit(),
      center: () => [homeX(), homeY()],
    }
  }

  const stopLoop = runLoop((dt, now) => {
    if (frozen) {
      draw(simNow)
      return
    }
    simNow = now
    step(dt)
    draw(now)
  })

  return () => {
    stopLoop()
    riser?.stop()
    dispose()
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointerup', release)
    canvas.removeEventListener('pointercancel', release)
  }
}
