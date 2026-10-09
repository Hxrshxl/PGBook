'use client'
import { useCallback, useRef, useState } from 'react'

/**
 * Wraps an async action with a busy flag and an error message.
 * While busy, further calls are ignored — this prevents double-submits.
 * `run` resolves to the action's result, or undefined if it failed.
 */
export function useAsyncAction(action) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  const run = useCallback(async (...args) => {
    if (inFlight.current) return undefined
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      return await action(...args)
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
      return undefined
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [action])

  return { run, busy, error, setError }
}
