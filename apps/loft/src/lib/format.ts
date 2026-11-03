/** A date and time in the reader's locale, like "25 Oct 2026, 9:30 am". */
export const when = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0)

/** A short time for a list: "6:02 am" today, "Yesterday", a weekday this week, then "25 Oct". */
export function shortWhen(time: number, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS)
  const date = new Date(time)
  if (days <= 0) {
    return date
      .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      .toLowerCase()
  }
  if (days === 1) return "Yesterday"
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" })
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}
