import { useState, useEffect } from 'react'

function getInitialDark() {
  const stored = localStorage.getItem('cat-cafe:theme')
  const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  // 同步设置，避免首屏闪烁
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  return isDark
}

export function useTheme() {
  const [isDark, setIsDark] = useState(getInitialDark)

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('cat-cafe:theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => setIsDark(d => !d)

  return { isDark, toggle }
}
