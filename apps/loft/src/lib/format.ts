/** A date and time in the reader's locale, like "25 Oct 2026, 9:30 am". */
export const when = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
