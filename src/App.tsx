import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { applyMeta, t } from './i18n'
import { startAnalytics, track } from './analytics'
import { landing, trackLanding } from './share'
import { Tag } from './components/Tag'
import { Hint } from './components/Hint'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    applyMeta('charge')
    startAnalytics('charge')
    trackLanding()
    return startGame(ref.current!, () => {
      setTouched(true)
      track('play_start')
    })
  }, [])
  return (
    <>
      <canvas ref={ref} />
      <Hint text={t('hint_charge')} hidden={touched} />
      {landing.recipient && <Tag text={t('charge_tag')} className="top-14" paper="bg-[#F4F7F8] text-[#1D2A30] font-medium" />}
      <MoreMenu current="charge" />
    </>
  )
}
