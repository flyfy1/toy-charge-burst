import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { Hint } from './components/Hint'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => startGame(ref.current!, () => setTouched(true)), [])
  return (
    <>
      <canvas ref={ref} />
      <Hint text="按住蓄力 · 松手引爆 · 狂点连环炸" hidden={touched} />
      <MoreMenu current="charge" />
    </>
  )
}
