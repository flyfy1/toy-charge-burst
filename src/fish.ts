// The pufferfish: front view, looking at the player. All geometry is in units of U
// (rest radius) in fish space, origin at the body centre, +y down.
// Body shading is baked once per size; spots, face, fins and spines are live.

export const N_SPINES = 44
export const EYE_X = 0.42
export const EYE_Y = -0.12
export const MOUTH_Y = 0.24

/** mulberry32: small seeded PRNG so every pose is repeatable under ?seed=. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Everything that changes how the fish looks. The game animates these; `poseFor` gives targets. */
export interface FishPose {
  x: number
  y: number
  /** inflation scale, 1 at rest, 1.85 full */
  s: number
  /** extra squash/stretch on top of s (poke, pfft flight) */
  sqx: number
  sqy: number
  /** stretch along a direction (pfft flight), 0 = none */
  stretch: number
  stretchAng: number
  rot: number
  /** 0..0.45 red multiply overlay */
  red: number
  blush: number
  /** 1 = sand, 0.85 = dazed and pale */
  sat: number
  /** per-spine erection 0..1 and presence 0..1 (bald regrow) */
  spine: Float32Array
  spineOn: Float32Array
  /** fraction of the eye left open by the upper lid, 0 shut .. 1 wide */
  lidOpen: number
  /** inward tilt of the lid line, radians (annoyed 12°, angry 22°) */
  lidTilt: number
  /** iris radius as a fraction of the rest iris (0.11U) */
  pupil: number
  /** gaze offset, -1..1 of the free travel */
  lookX: number
  lookY: number
  /** 0 pursed beak, 1 open "o" */
  mouthOpen: number
  /** 0 round pout, 1 flat pressed line */
  mouthFlat: number
  /** manga anger mark, 0..1 visible, pulse phase in radians */
  anger: number
  angerPulse: number
  /** sweat-drop bubble at the temple */
  sweat: number
  /** bald: eyes become two small dots */
  dots: number
  /** pectoral fin angle offsets, radians */
  finL: number
  finR: number
}

export function newPose(): FishPose {
  return {
    x: 0,
    y: 0,
    s: 1,
    sqx: 1,
    sqy: 1,
    stretch: 0,
    stretchAng: 0,
    rot: 0,
    red: 0,
    blush: 0,
    sat: 1,
    spine: new Float32Array(N_SPINES),
    spineOn: new Float32Array(N_SPINES).fill(1),
    lidOpen: 0.42,
    lidTilt: 0,
    pupil: 1,
    lookX: 0,
    lookY: 0.35,
    mouthOpen: 0,
    mouthFlat: 0,
    anger: 0,
    angerPulse: 0,
    sweat: 0,
    dots: 0,
    finL: 0,
    finR: 0,
  }
}

/** Gulp k (0..5) reached at this charge: gulps at 0.10, 0.28, 0.46, 0.64, 0.82. */
export const GULPS = [0.1, 0.28, 0.46, 0.64, 0.82]
export const gulpsAt = (c: number) => GULPS.filter((g) => c >= g).length
export const scaleForGulps = (k: number) => 1 + 0.17 * k

/** Static target pose for a charge (no springs, no time). `held` = finger is down. */
export function poseFor(p: FishPose, c: number, held: boolean, spineDelay?: Float32Array, wideFurious = false) {
  p.s = scaleForGulps(gulpsAt(c))
  p.red = 0.45 * smoothstep(0.5, 1, c)
  p.blush = 0.6 * smoothstep(0.3, 0.95, c)
  p.sat = 1
  p.dots = 0
  for (let i = 0; i < N_SPINES; i++) {
    const d = spineDelay ? spineDelay[i] : 0
    p.spine[i] = smoothstep(0.25, 0.7, c - d)
    p.spineOn[i] = 1
  }
  p.mouthOpen = 0
  p.lookX = 0
  if (!held && c < 0.02) {
    // idle: -_-
    p.lidOpen = 0.42
    p.lidTilt = 0
    p.pupil = 1
    p.lookY = 0.45
    p.mouthFlat = 0
    p.anger = 0
    p.sweat = 0
  } else if (c < 0.1) {
    // startled: snap open, pupils shrink
    p.lidOpen = 1
    p.lidTilt = 0
    p.pupil = 0.7
    p.lookY = 0
    p.mouthFlat = 0
    p.mouthOpen = 0.6
    p.anger = 0
    p.sweat = 0
  } else if (c < 0.45) {
    p.lidOpen = 0.7
    p.lidTilt = (12 * Math.PI) / 180
    p.pupil = 0.9
    p.lookY = 0.1
    p.mouthFlat = 1
    p.anger = 0
    p.sweat = 0
  } else if (c < 0.8) {
    p.lidOpen = 0.68
    p.lidTilt = (22 * Math.PI) / 180
    p.pupil = 0.85
    p.lookY = 0.05
    p.mouthFlat = 1
    p.anger = 1
    p.sweat = 0
  } else {
    p.lidOpen = wideFurious ? 1 : 0.9
    p.lidTilt = wideFurious ? 0 : (30 * Math.PI) / 180
    p.pupil = 0.3
    p.lookY = 0
    p.mouthFlat = 0.4
    p.anger = 1
    p.sweat = 1
  }
}

export function poseBald(p: FishPose) {
  p.s = 0.75
  p.red = 0
  p.blush = 0
  p.sat = 0.85
  p.spine.fill(0)
  p.spineOn.fill(0)
  p.lidOpen = 1
  p.lidTilt = 0
  p.pupil = 1
  p.lookX = 0
  p.lookY = 0
  p.mouthOpen = 0.35
  p.mouthFlat = 0
  p.anger = 0
  p.sweat = 0
  p.dots = 1
}

interface Spine {
  /** unit-disc position (multiply by rx, ry) */
  ux: number
  uy: number
  /** radius in the unit disc 0..1 */
  r: number
  /** outward direction */
  dx: number
  dy: number
  /** length factor from foreshortening (rim longest) */
  k: number
}

interface Spot {
  ux: number
  uy: number
  r: number
}


export class Fish {
  spines: Spine[] = []
  spots: Spot[] = []
  /** per-spine ripple delay in charge units (0..60 ms of 2.2 s) */
  delay = new Float32Array(N_SPINES)
  private body: HTMLCanvasElement | null = null
  private bakedFor = ''
  private bodyR = 0 // device px per U in the bake

  constructor(seed: number) {
    const rnd = rng(seed * 7919 + 13)
    const cand: Spine[] = []
    // Rim ring: these carry the silhouette. Skip the fins (sides) and the dorsal tuft (top).
    const RIM = 20
    for (let i = 0; i < RIM + 6 && cand.length < RIM; i++) {
      const a = (i / (RIM + 6)) * Math.PI * 2 + (rnd() - 0.5) * 0.12 - Math.PI / 2 + 0.11
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      if (Math.abs(sa - 0.1) < 0.28 && Math.abs(ca) > 0.9) continue // pectoral fins
      if (sa < -0.96) continue // dorsal tuft
      cand.push({ ux: ca * 0.97, uy: sa * 0.97, r: 0.97, dx: ca, dy: sa, k: 1 })
    }
    // Face and belly: sunflower over the disc; projected length shrinks toward the centre
    // (a spine there points at the viewer). Keep the ones that leave the eyes and mouth clear.
    const golden = Math.PI * (3 - Math.sqrt(5))
    const M = 64
    for (let n = 0; n < M && cand.length < N_SPINES; n++) {
      const r = 0.2 + 0.66 * Math.sqrt((n + 0.5) / M)
      const a = n * golden + (rnd() - 0.5) * 0.25
      const s: Spine = { ux: Math.cos(a) * r, uy: Math.sin(a) * r, r, dx: Math.cos(a), dy: Math.sin(a), k: 0.25 + 0.75 * r }
      if (this.clearOfFace(s)) cand.push(s)
    }
    // far ones first (rim), near ones last, so near spines draw on top
    cand.sort((p, q) => q.r - p.r)
    this.spines = cand
    for (let i = 0; i < N_SPINES; i++) this.delay[i] = (rnd() * 0.06) / 2.2
    // 14 spots, upper half only, clear of the eyes
    let guard = 0
    while (this.spots.length < 14 && guard++ < 500) {
      const a = Math.PI + rnd() * Math.PI // upper half
      const r = Math.sqrt(rnd()) * 0.9
      const ux = Math.cos(a) * r
      const uy = Math.sin(a) * r * 0.95 - 0.02
      const dE = Math.min(Math.hypot(ux * 1.08 - EYE_X, uy - EYE_Y), Math.hypot(ux * 1.08 + EYE_X, uy - EYE_Y))
      if (dE < 0.33) continue
      if (Math.abs(ux) < 0.22 && uy > -0.42) continue // nothing between the eyes that reads as a nose
      if (this.spots.some((o) => Math.hypot(o.ux - ux, o.uy - uy) < 0.2)) continue
      this.spots.push({ ux, uy, r: 0.035 + rnd() * 0.035 })
    }
  }

  /** At full inflation (round, s=1.85), does this spine stay off the eyes, mouth and anger mark? */
  private clearOfFace(s: Spine): boolean {
    const S = 1.85
    const eyeR = 0.2 * Math.sqrt(S) * 1.45
    const bx = s.ux * S
    const by = s.uy * S
    const len = 0.32 * s.k
    const pts = 6
    for (let i = 0; i <= pts; i++) {
      const t = i / pts
      const x = bx + s.dx * len * t
      const y = by + s.dy * len * t
      for (const ex of [-EYE_X, EYE_X]) if (Math.hypot(x - (ex * S) / 1.08, y - EYE_Y * S) < eyeR) return false
      if (Math.hypot(x - 0.6 * S, y + 0.62 * S) < 0.3 * S * 0.5) return false // anger mark
      if (Math.hypot((x - 0) / 1.4, y - MOUTH_Y * S) < 0.2) return false
    }
    // keep the very centre clear too: a spine pointing at the viewer reads as a blemish
    return true
  }

  private bake(U: number, dpr: number) {
    const key = `${U.toFixed(2)}|${dpr}`
    if (key === this.bakedFor && this.body) return
    this.bakedFor = key
    // bake at full-inflation size so drawing is always a downscale
    const R = 1.9 * U * dpr
    this.bodyR = R
    const sz = Math.ceil(R * 2.3)
    const c = this.body ?? document.createElement('canvas')
    c.width = c.height = sz
    const g = c.getContext('2d')!
    g.clearRect(0, 0, sz, sz)
    g.setTransform(R, 0, 0, R, sz / 2, sz / 2) // unit circle body
    g.save()
    g.beginPath()
    g.arc(0, 0, 1, 0, Math.PI * 2)
    g.clip()
    // lit from the upper left
    const lg = g.createRadialGradient(-0.3, -0.4, 0, 0, 0, 1)
    lg.addColorStop(0, '#E9C770')
    lg.addColorStop(0.18, '#E2BD63')
    lg.addColorStop(0.6, '#C9A24B')
    lg.addColorStop(1, '#8A6A2A')
    g.fillStyle = lg
    g.fillRect(-1, -1, 2, 2)
    // cream belly over the lower 45 %, feathered
    g.save()
    g.translate(0, 0.78)
    g.scale(1.25, 0.82)
    const bg = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    bg.addColorStop(0, 'rgba(255,246,224,1)')
    bg.addColorStop(0.62, 'rgba(255,246,224,0.97)')
    bg.addColorStop(0.8, 'rgba(250,236,200,0.55)')
    bg.addColorStop(1, 'rgba(240,220,170,0)')
    g.fillStyle = bg
    g.beginPath()
    g.arc(0, 0, 1, 0, Math.PI * 2)
    g.fill()
    g.restore()
    // form shadow: darker toward the lower right rim (belly too)
    const fs = g.createRadialGradient(-0.28, -0.36, 0.35, -0.05, -0.05, 1.12)
    fs.addColorStop(0, 'rgba(70,45,10,0)')
    fs.addColorStop(0.7, 'rgba(70,45,10,0.10)')
    fs.addColorStop(1, 'rgba(60,38,8,0.42)')
    g.fillStyle = fs
    g.fillRect(-1, -1, 2, 2)
    // cool bounce light from the water, soft, on the lower right edge
    const rl = g.createRadialGradient(-0.2, -0.24, 0.6, -0.04, -0.05, 1.02)
    rl.addColorStop(0, 'rgba(159,232,255,0)')
    rl.addColorStop(0.78, 'rgba(159,232,255,0)')
    rl.addColorStop(1, 'rgba(159,232,255,0.32)')
    g.fillStyle = rl
    g.fillRect(-1, -1, 2, 2)
    // soft wet specular on the upper left
    g.save()
    g.translate(-0.42, -0.55)
    g.rotate(-0.6)
    g.scale(1, 0.55)
    const sp = g.createRadialGradient(0, 0, 0, 0, 0, 0.32)
    sp.addColorStop(0, 'rgba(255,255,240,0.55)')
    sp.addColorStop(0.5, 'rgba(255,255,240,0.18)')
    sp.addColorStop(1, 'rgba(255,255,240,0)')
    g.fillStyle = sp
    g.beginPath()
    g.arc(0, 0, 0.32, 0, Math.PI * 2)
    g.fill()
    g.restore()
    g.restore()
    this.body = c
  }

  /** Body half-axes in U for a pose (before squash). */
  static axes(p: FishPose) {
    const infl = Math.max(0, Math.min(1, (p.s - 1) / 0.85))
    const ry = p.s
    const rx = p.s * lerp(1.08, 1.0, infl)
    return { rx, ry, infl }
  }

  draw(ctx: CanvasRenderingContext2D, p: FishPose, U: number, dpr: number, time: number) {
    this.bake(U, dpr)
    const { rx, ry, infl } = Fish.axes(p)
    ctx.save()
    ctx.translate(p.x, p.y)
    if (p.stretch) {
      ctx.rotate(p.stretchAng)
      ctx.scale(1 + p.stretch, 1 / (1 + p.stretch * 0.5))
      ctx.rotate(-p.stretchAng)
    }
    ctx.rotate(p.rot)
    ctx.scale(U * p.sqx, U * p.sqy)
    // ---- behind the body: rim spines, fins, dorsal tuft
    const lw = 1 / U // one css px in fish units
    this.drawFins(ctx, p, rx, ry, lw, time)
    this.drawSpines(ctx, p, rx, ry, true)
    // ---- body
    const bR = this.bodyR / (U * dpr) // bake radius in U (1.9)
    const img = this.body!
    const half = img.width / 2 / (U * dpr)
    ctx.save()
    ctx.scale(rx / bR, ry / bR)
    ctx.drawImage(img, -half, -half, half * 2, half * 2)
    ctx.restore()
    // body clip for overlays
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.clip()
    // spots in body space: they spread as it swells and fade as the skin stretches
    ctx.fillStyle = '#5B4520'
    ctx.globalAlpha = lerp(0.55, 0.3, infl)
    for (const s of this.spots) {
      ctx.beginPath()
      ctx.ellipse(s.ux * rx, s.uy * ry, s.r * lerp(1, 1.25, infl), s.r * lerp(1, 1.25, infl) * 0.92, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (p.red > 0.001) {
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = p.red
      ctx.fillStyle = '#E8452C'
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    if (p.sat < 0.995) {
      // dazed and pale: a grey 'saturation' wash (much cheaper than ctx.filter)
      ctx.globalCompositeOperation = 'saturation'
      ctx.globalAlpha = 1 - p.sat
      ctx.fillStyle = '#808080'
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    ctx.restore()
    // ---- face spines (front of the body)
    this.drawSpines(ctx, p, rx, ry, false)
    // ---- face
    this.drawFace(ctx, p, rx, ry, lw)
    ctx.restore()
  }

  private drawFins(ctx: CanvasRenderingContext2D, p: FishPose, rx: number, ry: number, lw: number, time: number) {
    const furious = p.anger * 0.5 + p.sweat * 0.5
    const hz = lerp(3, 9, furious)
    const amp = lerp(18, 30, furious) * (Math.PI / 180)
    for (const side of [-1, 1]) {
      const ph = time * hz * Math.PI * 2 + (side > 0 ? 0.9 : 0)
      const a = Math.sin(ph) * amp + (side < 0 ? p.finL : p.finR)
      ctx.save()
      ctx.translate(side * rx * 0.9, 0.1 * ry)
      ctx.scale(side, 1)
      ctx.rotate(0.22 + a) // fan points outward and a little down
      this.fan(ctx, 0.42 * Math.sqrt(p.s), 1.25, 5, lw, p.red)
      ctx.restore()
    }
    // dorsal tuft on top
    ctx.save()
    ctx.translate(0.05 * rx, -ry * 0.93)
    ctx.rotate(-Math.PI / 2 + 0.12 + Math.sin(time * 2.2) * 0.12)
    this.fan(ctx, 0.24 * Math.sqrt(p.s), 0.9, 4, lw, p.red)
    ctx.restore()
  }

  /** A rounded fin fan pointing along +x from the origin. */
  private fan(ctx: CanvasRenderingContext2D, L: number, spread: number, rays: number, lw: number, red: number) {
    // same flush as the body: multiply by #E8452C at `red`
    const m = (v: number, k: number) => Math.round(v * (1 - red + (red * k) / 255))
    const C = (r: number, g: number, b: number, a: number) => `rgba(${m(r, 0xe8)},${m(g, 0x45)},${m(b, 0x2c)},${a})`
    const a0 = -spread / 2
    const step = spread / (rays - 1)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let i = 0; i < rays; i++) {
      const a = a0 + i * step
      const Li = L * (0.82 + 0.18 * Math.sin((i / (rays - 1)) * Math.PI))
      const tx = Math.cos(a) * Li
      const ty = Math.sin(a) * Li
      if (i === 0) ctx.lineTo(tx, ty)
      else {
        // membrane dips slightly between rays
        const am = a - step / 2
        const Lm = Li * 0.9
        ctx.quadraticCurveTo(Math.cos(am) * Lm * 1.04, Math.sin(am) * Lm * 1.04, tx, ty)
      }
    }
    ctx.closePath()
    const g = ctx.createLinearGradient(0, 0, L, 0)
    g.addColorStop(0, C(200, 160, 70, 0.95))
    g.addColorStop(1, C(240, 210, 128, 0.78))
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,236,180,0.55)'
    ctx.lineWidth = 0.8 * lw
    ctx.stroke()
    ctx.strokeStyle = C(184, 146, 60, 0.9)
    ctx.lineWidth = 0.8 * lw
    ctx.lineCap = 'round'
    for (let i = 0; i < rays; i++) {
      const a = a0 + i * step
      const Li = L * (0.8 + 0.18 * Math.sin((i / (rays - 1)) * Math.PI))
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * L * 0.08, Math.sin(a) * L * 0.08)
      ctx.lineTo(Math.cos(a) * Li * 0.95, Math.sin(a) * Li * 0.95)
      ctx.stroke()
    }
  }

  private drawSpines(ctx: CanvasRenderingContext2D, p: FishPose, rx: number, ry: number, rim: boolean) {
    const base = 0.05
    for (let i = 0; i < this.spines.length; i++) {
      const s = this.spines[i]
      const isRim = s.r > 0.95
      if (isRim !== rim) continue
      const on = p.spineOn[i]
      if (on <= 0.01) {
        continue
      }
      const e = p.spine[i]
      // rim spines grow a little with the body so the full silhouette reads as a spiky ball
      const len = (0.04 + 0.28 * e) * s.k * on * Math.pow(p.s, isRim ? 0.6 : 0.35)
      if (len < 0.01) continue
      // base point on the body surface; rim spines root just inside the silhouette
      const br = isRim ? Math.min(s.r, 0.93) : s.r
      const bx = s.ux * (br / s.r) * rx
      const by = s.uy * (br / s.r) * ry
      // direction: radial in body space, normalised after the ellipse stretch
      let dx = s.dx * rx
      let dy = s.dy * ry
      const dl = Math.hypot(dx, dy)
      dx /= dl
      dy /= dl
      const nx = -dy
      const ny = dx
      const hb = (base / 2) * Math.sqrt(p.s) * (0.6 + 0.4 * on) * Math.min(1, 0.5 + e)
      const tx = bx + dx * len
      const ty = by + dy * len
      if (!rim) {
        // contact shadow on the skin (light from the upper left, so it falls lower right)
        ctx.fillStyle = 'rgba(70,45,12,0.28)'
        ctx.beginPath()
        ctx.moveTo(bx + nx * hb, by + ny * hb)
        ctx.lineTo(tx + 0.03 * e, ty + 0.045 * e)
        ctx.lineTo(bx - nx * hb, by - ny * hb)
        ctx.fill()
      }
      // shaft: cream, lit side and shade side
      ctx.fillStyle = '#FFF3D0'
      ctx.beginPath()
      ctx.moveTo(bx + nx * hb, by + ny * hb)
      ctx.lineTo(tx, ty)
      ctx.lineTo(bx - nx * hb, by - ny * hb)
      ctx.fill()
      // the side facing away from the light gets a darker half
      const away = nx * 0.6 + ny * 0.8 > 0 ? 1 : -1
      ctx.fillStyle = 'rgba(184,146,60,0.55)'
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(tx, ty)
      ctx.lineTo(bx + nx * hb * away, by + ny * hb * away)
      ctx.fill()
      // root
      ctx.fillStyle = '#B8923C'
      ctx.beginPath()
      ctx.moveTo(bx + nx * hb * 1.15, by + ny * hb * 1.15)
      ctx.lineTo(bx + dx * len * 0.3, by + dy * len * 0.3)
      ctx.lineTo(bx - nx * hb * 1.15, by - ny * hb * 1.15)
      ctx.fill()
    }
  }

  private drawFace(ctx: CanvasRenderingContext2D, p: FishPose, rx: number, ry: number, lw: number) {
    const ex = EYE_X * (rx / 1.08)
    const ey = EYE_Y * ry
    const es = Math.pow(p.s, 0.5) // eyes grow slower than the body
    const re = 0.2 * es
    // blush under the eyes
    if (p.blush > 0.01) {
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(side * (ex + 0.06 * es), ey + re + 0.12 * es)
        ctx.scale(1, 0.6)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.2 * es)
        g.addColorStop(0, `rgba(255,142,122,${p.blush})`)
        g.addColorStop(1, 'rgba(255,142,122,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, 0.2 * es, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
    for (const side of [-1, 1]) this.drawEye(ctx, p, side * ex, ey, re, side, lw)
    this.drawMouth(ctx, p, 0, MOUTH_Y * ry, es, lw)
    if (p.anger > 0.01) {
      const k = (0.9 + 0.1 * Math.sin(p.angerPulse)) * p.anger
      this.angerMark(ctx, rx * 0.64, -ry * 0.66, 0.3 * es * k, lw)
    }
    if (p.sweat > 0.01) this.sweatDrop(ctx, -rx * 0.78, -ry * 0.42, 0.12 * es * p.sweat, lw)
  }

  private drawEye(ctx: CanvasRenderingContext2D, p: FishPose, x: number, y: number, re: number, side: number, lw: number) {
    if (p.dots > 0.5) {
      // dazed: two small dots, nothing behind them
      ctx.fillStyle = '#1B2A33'
      ctx.beginPath()
      ctx.arc(x, y + re * 0.1, re * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(x - re * 0.09, y, re * 0.09, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    // socket: puffer eyes sit in a slightly raised ring
    ctx.fillStyle = 'rgba(110,80,25,0.35)'
    ctx.beginPath()
    ctx.ellipse(x, y + re * 0.06, re * 1.26, re * 1.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,240,200,0.35)'
    ctx.beginPath()
    ctx.ellipse(x - re * 0.15, y - re * 0.2, re * 1.12, re * 1.05, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, re, 0, Math.PI * 2)
    ctx.clip()
    // sclera with a soft shade under the lid
    const sg = ctx.createRadialGradient(x - re * 0.3, y - re * 0.3, 0, x, y, re)
    sg.addColorStop(0, '#FFFFFF')
    sg.addColorStop(0.75, '#F4F7F8')
    sg.addColorStop(1, '#C9D3D6')
    ctx.fillStyle = sg
    ctx.fillRect(x - re, y - re, re * 2, re * 2)
    // iris and pupil
    const ri = 0.11 * Math.pow(p.s, 0.5) * p.pupil
    const free = re - ri - re * 0.08
    const ix = x + p.lookX * free
    const iy = y + p.lookY * free
    ctx.fillStyle = '#1B2A33'
    ctx.beginPath()
    ctx.arc(ix, iy, ri, 0, Math.PI * 2)
    ctx.fill()
    if (p.pupil > 0.5) {
      // a faint warm ring so the iris is not a flat hole
      ctx.strokeStyle = 'rgba(120,150,110,0.45)'
      ctx.lineWidth = ri * 0.22
      ctx.beginPath()
      ctx.arc(ix, iy, ri * 0.82, 0, Math.PI * 2)
      ctx.stroke()
    }
    // catchlight (stays put: it is the light, not the eye)
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(ix - ri * 0.42, iy - ri * 0.46, Math.max(0.035 * Math.pow(p.s, 0.5) * Math.min(1, p.pupil + 0.3), 1.2 * lw), 0, Math.PI * 2)
    ctx.fill()
    if (p.pupil > 0.5) {
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.arc(ix + ri * 0.4, iy + ri * 0.38, 0.018 * Math.pow(p.s, 0.5), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // upper lid: body-coloured cap, angle and height carry the expression
    if (p.lidOpen < 0.995) {
      const yL = y - re + 2 * re * (1 - p.lidOpen)
      const t = Math.tan(p.lidTilt) * -side // inner side lower
      const x0 = x - re * 1.2
      const x1 = x + re * 1.2
      const yl = (xx: number) => yL + t * (xx - x)
      ctx.fillStyle = '#D2AD58'
      ctx.beginPath()
      ctx.moveTo(x0, y - re * 1.2)
      ctx.lineTo(x1, y - re * 1.2)
      ctx.lineTo(x1, yl(x1))
      ctx.lineTo(x0, yl(x0))
      ctx.closePath()
      ctx.fill()
      if (p.red > 0.001) {
        ctx.globalCompositeOperation = 'multiply'
        ctx.globalAlpha = p.red
        ctx.fillStyle = '#E8452C'
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }
      // lid shadow on the eyeball, then the lid rim
      const sh = ctx.createLinearGradient(0, yL, 0, yL + re * 0.35)
      sh.addColorStop(0, 'rgba(60,50,30,0.35)')
      sh.addColorStop(1, 'rgba(60,50,30,0)')
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x0, yl(x0))
      ctx.lineTo(x1, yl(x1))
      ctx.lineTo(x1, yl(x1) + re * 0.4)
      ctx.lineTo(x0, yl(x0) + re * 0.4)
      ctx.closePath()
      ctx.fillStyle = sh
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = '#4A3718'
      ctx.lineWidth = Math.max(1.3 * lw, re * 0.13)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, yl(x0))
      ctx.lineTo(x1, yl(x1))
      ctx.stroke()
    }
    ctx.restore()
    // thin outline so the eye holds its shape on the red body
    ctx.strokeStyle = 'rgba(74,55,24,0.7)'
    ctx.lineWidth = 0.9 * lw
    ctx.beginPath()
    ctx.arc(x, y, re, 0, Math.PI * 2)
    ctx.stroke()
  }

  private drawMouth(ctx: CanvasRenderingContext2D, p: FishPose, x: number, y: number, es: number, lw: number) {
    const w = 0.16 * es
    const flat = p.mouthFlat
    const open = p.mouthOpen
    // lips: a small rounded beak; flat squeezes it into a pressed line, open rounds it into an "o"
    const lh = (lerp(0.1, 0.05, flat) + open * 0.02) * es
    const lwid = lerp(w * 0.5, w * 0.62, flat) * (1 + open * 0.2)
    ctx.fillStyle = '#E9A08C'
    ctx.beginPath()
    ctx.ellipse(x, y, lwid, lh, 0, 0, Math.PI * 2)
    ctx.fill()
    // lit top of the beak
    ctx.fillStyle = 'rgba(255,214,196,0.8)'
    ctx.beginPath()
    ctx.ellipse(x - lwid * 0.15, y - lh * 0.4, lwid * 0.5, lh * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    if (open > 0.05) {
      ctx.fillStyle = '#3A1E1A'
      ctx.beginPath()
      ctx.ellipse(x, y + lh * 0.08, lwid * 0.62 * open, lh * 0.66 * open, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // closed: the line between the lips; it sags at the corners when annoyed
      ctx.strokeStyle = '#7A3E33'
      ctx.lineWidth = 1.1 * lw
      ctx.lineCap = 'round'
      ctx.beginPath()
      const sag = flat * lh * 0.5
      ctx.moveTo(x - lwid * 0.78, y + sag)
      ctx.quadraticCurveTo(x, y - sag * 0.6, x + lwid * 0.78, y + sag)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(150,80,60,0.6)'
    ctx.lineWidth = 0.8 * lw
    ctx.beginPath()
    ctx.ellipse(x, y, lwid, lh, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  /** Manga anger mark: four curved brackets with their corners pointing in. */
  private angerMark(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, lw: number) {
    if (S <= 0) return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(0.2)
    ctx.lineCap = 'round'
    const path = () => {
      ctx.beginPath()
      for (let q = 0; q < 4; q++) {
        const c = Math.cos((q * Math.PI) / 2)
        const s = Math.sin((q * Math.PI) / 2)
        const P = (u: number, v: number): [number, number] => [(u * c - v * s) * S, (u * s + v * c) * S]
        const a = P(0.16, 0.58)
        const m = P(0.2, 0.2)
        const b = P(0.58, 0.16)
        ctx.moveTo(a[0], a[1])
        ctx.quadraticCurveTo(m[0], m[1], b[0], b[1])
      }
    }
    path()
    ctx.strokeStyle = 'rgba(255,243,208,0.9)'
    ctx.lineWidth = 5.5 * lw
    ctx.stroke()
    path()
    ctx.strokeStyle = '#E8452C'
    ctx.lineWidth = 3 * lw
    ctx.stroke()
    ctx.restore()
  }

  private sweatDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lw: number) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.35)
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.9)
    ctx.bezierCurveTo(r * 0.5, -r * 1.0, r * 1.0, -r * 0.45, r, 0)
    ctx.arc(0, 0, r, 0, Math.PI)
    ctx.bezierCurveTo(-r * 1.0, -r * 0.45, -r * 0.5, -r * 1.0, 0, -r * 1.9)
    const dg = ctx.createLinearGradient(0, -r * 1.9, 0, r)
    dg.addColorStop(0, 'rgba(214,246,255,0.75)')
    dg.addColorStop(1, 'rgba(120,210,245,0.85)')
    ctx.fillStyle = dg
    ctx.fill()
    ctx.strokeStyle = 'rgba(230,250,255,0.95)'
    ctx.lineWidth = 1.1 * lw
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(-r * 0.35, -r * 0.2, r * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** World position of spine i's tip and its outward direction (ignores rot/stretch; used at full puff). */
  spineWorld(p: FishPose, U: number, i: number): { x: number; y: number; dx: number; dy: number } {
    const { rx, ry } = Fish.axes(p)
    const s = this.spines[i]
    const isRim = s.r > 0.95
    const br = isRim ? Math.min(s.r, 0.93) : s.r
    let dx = s.dx * rx
    let dy = s.dy * ry
    const dl = Math.hypot(dx, dy)
    dx /= dl
    dy /= dl
    const len = (0.04 + 0.28 * p.spine[i]) * s.k * Math.pow(p.s, isRim ? 0.6 : 0.35)
    const bx = (s.ux * (br / s.r) * rx + dx * len) * U * p.sqx
    const by = (s.uy * (br / s.r) * ry + dy * len) * U * p.sqy
    return { x: p.x + bx, y: p.y + by, dx, dy }
  }

  /** World position of the mouth. */
  mouthWorld(p: FishPose, U: number): [number, number] {
    const { ry } = Fish.axes(p)
    const y = MOUTH_Y * ry * U * p.sqy
    return [p.x - Math.sin(p.rot) * y, p.y + Math.cos(p.rot) * y]
  }

  /** Radius in css px that contains the body and fins (for keeping it on screen). */
  extent(p: FishPose, U: number): { ex: number; ey: number } {
    const { rx, ry } = Fish.axes(p)
    return { ex: (rx * 0.9 + 0.42 * Math.sqrt(p.s) + 0.05) * U * p.sqx, ey: (ry + 0.25) * U * p.sqy }
  }

  /** Is (x, y) in css px inside the fish body? */
  hit(p: FishPose, U: number, x: number, y: number): boolean {
    const { rx, ry } = Fish.axes(p)
    const dx = (x - p.x) / (rx * U * p.sqx)
    const dy = (y - p.y) / (ry * U * p.sqy)
    return dx * dx + dy * dy <= 1.15
  }
}
