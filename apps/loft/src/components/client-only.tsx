import { type ReactNode, useEffect, useState } from "react"

/** Renders its children only in the browser, for anything that depends on the local clock. */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}
