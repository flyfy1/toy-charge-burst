import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { applyMeta, t } from './i18n'
import { startAnalytics, track } from './analytics'
import { Hint } from './components/Hint'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    applyMeta('charge')
    startAnalytics('charge')
    return startGame(ref.current!, () => {
      setTouched(true)
      track('play_start')
    })
  }, [])
  return (
    <>
      <canvas ref={ref} />
      <Hint text={t('hint_charge')} hidden={touched} />
      <MoreMenu current="charge" />
    </>
  )
}
