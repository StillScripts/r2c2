import { useEffect, useEffectEvent, useRef, useState } from "react"

const DEBOUNCE_MS = 400

/** The latest result of `run`, called once `key` stops changing. Stale responses are dropped. */
export function useDebouncedResult<T>(
  key: string | undefined,
  run: () => Promise<T>
) {
  const [result, setResult] = useState<T>()
  const call = useEffectEvent(run)
  const latest = useRef(0)

  useEffect(() => {
    if (key === undefined) return
    const request = ++latest.current
    const timer = setTimeout(() => {
      call().then(
        (value) => request === latest.current && setResult(value),
        () => {}
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [key])

  return result
}
