import { useState } from 'react'

export type Theme = 'poster' | 'stadium'

const STORAGE_KEY = 'sprint-series-theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'poster'
  )

  function setTheme(t: Theme) {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }

  return { theme, setTheme }
}
