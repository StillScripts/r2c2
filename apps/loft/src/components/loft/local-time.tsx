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
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setTime(now())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  return <time className="font-mono text-xs text-muted-foreground">{time}</time>
}
