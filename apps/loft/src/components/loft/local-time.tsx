import { useEffect, useState } from "react"

const format = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
})

const now = () => format.format(new Date()).toLowerCase()

/** The local time, as `7:12 pm`. Blank until mounted, so it can't mismatch the server's HTML. */
export function LocalTime() {
  const [time, setTime] = useState<string>()

  useEffect(() => {
    setTime(now())
    let interval: ReturnType<typeof setInterval> | undefined
    const timer = setTimeout(
      () => {
        setTime(now())
        interval = setInterval(() => setTime(now()), 60_000)
      },
      60_000 - (Date.now() % 60_000)
    )
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  return <time className="font-mono text-xs text-muted-foreground">{time}</time>
}
