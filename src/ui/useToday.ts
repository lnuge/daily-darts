import { useEffect, useState } from 'react'
import { puzzleEndsAt, todayKey } from '../lib/daily'

/**
 * Today's date key, updating at local midnight. Also rechecks when the tab
 * becomes visible or focused again, because timers in background tabs and
 * sleeping devices can fire late.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => setToday(todayKey())
    const schedule = () => {
      // A moment past midnight, so the new date has definitely begun.
      const delay = puzzleEndsAt(todayKey()).getTime() - Date.now() + 250
      timer = setTimeout(() => {
        check()
        schedule()
      }, delay)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
