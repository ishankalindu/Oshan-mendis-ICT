import { useEffect } from 'react'

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
  }, [])
  return children
}
