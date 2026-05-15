'use client'

import { useEffect, useState } from 'react'

export function useCountdown(expiresAt: string): number {
  const calc = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

  const [secs, setSecs] = useState(calc)

  useEffect(() => {
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])

  return secs
}