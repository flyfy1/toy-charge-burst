// The sea around the fish: a baked backdrop (gradient, warm light shafts, sandy bottom, a rock
// and a shell) plus a few seaweed fronds, the only live part (one tapered stroke each).

import { rng } from './fish'

interface Frond {
  x: number
  h: number
  w: number
  phase: number
  col: string
  lean: number
}

export class Sea {
  private bg: HTMLCanvasElement | null = null
  private key = ''
  private fronds: Frond[] = []
  /** y of the sand line at the left and right edge, css px */
  sandY = 0

  constructor(private seed: number) {}

  private build(w: number, h: number, dpr: number) {
    const rnd = rng(this.seed * 31 + 7)
    const c = this.bg ?? document.createElement('canvas')
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const lg = g.createLinearGradient(0, 0, 0, h)
    lg.addColorStop(0, '#0A2A38')
    lg.addColorStop(0.55, '#05172A')
    lg.addColorStop(1, '#020810')
    g.fillStyle = lg
    g.fillRect(0, 0, w, h)

    // warm light shafts on their own layer: soft sides, faded toward the bottom
    const L = document.createElement('canvas')
    L.width = c.width
    L.height = c.height
    const l = L.getContext('2d')!
    l.setTransform(dpr, 0, 0, dpr, 0, 0)
    const shaft = (x: number, width: number, a: number) => {
      l.save()
      l.translate(x, -20)
      l.rotate((12 * Math.PI) / 180)
      const xg = l.createLinearGradient(-width / 2, 0, width / 2, 0)
      xg.addColorStop(0, 'rgba(255,236,190,0)')
      xg.addColorStop(0.5, `rgba(255,236,190,${a})`)
      xg.addColorStop(1, 'rgba(255,236,190,0)')
      l.fillStyle = xg
      l.fillRect(-width / 2, 0, width, h * 1.3)
      l.restore()
    }
    shaft(w * 0.2, w * 0.2, 0.06)
    shaft(w * 0.5, w * 0.1, 0.05)
    shaft(w * 0.76, w * 0.3, 0.055)
    l.globalCompositeOperation = 'destination-in'
    const vf = l.createLinearGradient(0, 0, 0, h)
    vf.addColorStop(0, 'rgba(0,0,0,1)')
    vf.addColorStop(0.9, 'rgba(0,0,0,0)')
    l.fillStyle = vf
    l.fillRect(0, 0, w, h)
    // a soft glow where the surface light comes from
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'lighter'
    g.drawImage(L, 0, 0)
    g.restore()
    const top = g.createRadialGradient(w * 0.35, -h * 0.05, 0, w * 0.35, -h * 0.05, Math.max(w, h) * 0.6)
    top.addColorStop(0, 'rgba(120,200,220,0.10)')
    top.addColorStop(1, 'rgba(120,200,220,0)')
    g.fillStyle = top
    g.fillRect(0, 0, w, h)

    // sandy bottom: a low dune, lit along its crest, with grain
    const m = Math.min(w, h)
    const base = h - Math.max(56, h * 0.062) // below the hint line (80 px up), so the crest never cuts the text
    this.sandY = base
    const dune = (x: number) => base + Math.sin((x / w) * Math.PI * 1.3 + 0.6) * m * 0.018 + Math.sin((x / w) * Math.PI * 3.1) * m * 0.008
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 8) g.lineTo(x, dune(x))
    g.lineTo(w, h)
    g.closePath()
    const sg = g.createLinearGradient(0, base - m * 0.03, 0, h)
    sg.addColorStop(0, '#7A6E52')
    sg.addColorStop(0.25, '#4A4232')
    sg.addColorStop(1, '#14130E')
    g.fillStyle = sg
    g.fill()
    g.save()
    g.clip()
    for (let i = 0; i < (w * (h - base)) / 90; i++) {
      const x = rnd() * w
      const y = base - m * 0.03 + rnd() * (h - base + m * 0.03)
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,200,0.07)' : 'rgba(0,0,0,0.12)'
      g.fillRect(x, y, 1, 1)
    }
    g.restore()
    g.strokeStyle = 'rgba(230,220,180,0.18)'
    g.lineWidth = 1.2
    g.beginPath()
    for (let x = 0; x <= w; x += 8) (x ? g.lineTo(x, dune(x)) : g.moveTo(x, dune(x)))
    g.stroke()

    // a rock on the left, a shell on the right
    const rx = w * 0.14
    const ry = dune(rx) + m * 0.012
    const rr = m * 0.1
    g.save()
    g.translate(rx, ry)
    g.beginPath()
    g.moveTo(-rr, 0)
    g.bezierCurveTo(-rr, -rr * 0.7, -rr * 0.3, -rr * 0.95, rr * 0.2, -rr * 0.85)
    g.bezierCurveTo(rr * 0.8, -rr * 0.75, rr * 1.1, -rr * 0.3, rr * 1.05, 0)
    g.closePath()
    const rg = g.createLinearGradient(-rr * 0.4, -rr, rr * 0.4, 0)
    rg.addColorStop(0, '#3E5560')
    rg.addColorStop(1, '#16222A')
    g.fillStyle = rg
    g.fill()
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.beginPath()
    g.ellipse(rr * 0.05, 1, rr * 1.15, rr * 0.12, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
    // scallop shell
    const sx = w * 0.8
    const sy = dune(sx) + m * 0.008
    const sr = m * 0.05
    g.save()
    g.translate(sx, sy)
    g.rotate(-0.15)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.beginPath()
    g.ellipse(0, 1, sr * 1.1, sr * 0.18, 0, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(0, 0)
    const ribs = 7
    for (let i = 0; i <= ribs; i++) {
      const a = Math.PI + 0.25 + (i / ribs) * (Math.PI - 0.5)
      const aN = Math.PI + 0.25 + ((i + 0.5) / ribs) * (Math.PI - 0.5)
      if (i === 0) g.lineTo(Math.cos(a) * sr, Math.sin(a) * sr)
      else g.quadraticCurveTo(Math.cos(aN - 0.5 / ribs) * sr * 1.08, Math.sin(aN - 0.5 / ribs) * sr * 1.08, Math.cos(a) * sr, Math.sin(a) * sr)
    }
    g.closePath()
    const shg = g.createLinearGradient(0, -sr, 0, 0)
    shg.addColorStop(0, '#D9C4A2')
    shg.addColorStop(1, '#8F7A5C')
    g.fillStyle = shg
    g.fill()
    g.strokeStyle = 'rgba(110,88,60,0.6)'
    g.lineWidth = 0.8
    for (let i = 1; i < ribs; i++) {
      const a = Math.PI + 0.25 + (i / ribs) * (Math.PI - 0.5)
      g.beginPath()
      g.moveTo(0, -sr * 0.05)
      g.lineTo(Math.cos(a) * sr * 0.95, Math.sin(a) * sr * 0.95)
      g.stroke()
    }
    g.fillStyle = '#7E6A4E'
    g.fillRect(-sr * 0.22, -sr * 0.12, sr * 0.44, sr * 0.14)
    g.restore()
    this.bg = c

    // seaweed: a clump behind the rock, one on the right
    this.fronds = []
    const clump = (x0: number, n: number, hgt: number) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + (rnd() - 0.5) * m * 0.08
        this.fronds.push({
          x,
          h: hgt * (0.6 + rnd() * 0.5),
          w: m * (0.028 + rnd() * 0.016),
          phase: rnd() * 6.28,
          col: ['#1F4C3A', '#28604A', '#2F6E55'][i % 3],
          lean: (rnd() - 0.5) * 0.3,
        })
      }
    }
    clump(w * 0.1, 3, h * 0.2)
    clump(w * 0.9, 2, h * 0.14)
    this.dune = dune
  }

  private dune: (x: number) => number = () => 0

  /** Draw the baked sea (no shake: it is the world, it does not move). */
  drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
    const key = `${w}x${h}@${dpr}`
    if (key !== this.key || !this.bg) {
      this.key = key
      this.build(w, h, dpr)
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.bg!, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Seaweed ribbons, swaying. `surge` (0..1) leans them toward the fish while it sucks water in. */
  drawWeed(ctx: CanvasRenderingContext2D, time: number, towardX: number, surge: number) {
    const N = 12
    const L: number[] = []
    const R: number[] = []
    for (const f of this.fronds) {
      const y0 = this.dune(f.x) + 4
      const pull = Math.sign(towardX - f.x) * surge * 0.25
      L.length = R.length = 0
      let x = f.x
      let y = y0
      let px = x
      let py = y
      for (let i = 0; i <= N; i++) {
        const u = i / N
        if (i > 0) {
          // each segment bends a little more: a travelling wave up the frond
          const a = f.lean + pull * u + Math.sin(time * 1.3 + f.phase - u * 3.2) * 0.32 * u
          x = px + Math.sin(a) * (f.h / N)
          y = py - Math.cos(a) * (f.h / N)
        }
        const dx = x - px || 0.0001
        const dy = y - py || -1
        const dl = Math.hypot(dx, dy)
        const hw = (f.w / 2) * (1 - u * 0.8) * (1 + 0.35 * Math.sin(u * 11 + f.phase))
        L.push(x - (dy / dl) * hw * -1, y + (dx / dl) * hw * -1)
        R.push(x + (dy / dl) * hw * -1, y - (dx / dl) * hw * -1)
        px = x
        py = y
      }
      ctx.beginPath()
      ctx.moveTo(L[0], L[1])
      for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1])
      for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1])
      ctx.closePath()
      ctx.fillStyle = f.col
      ctx.fill()
    }
  }
}
