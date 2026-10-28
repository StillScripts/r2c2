import { cn } from "@workspace/ui/lib/utils"
import type { ComponentProps } from "react"

/** A monospace textarea for HTML and CSS, without spellcheck. */
export function CodeTextarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      spellCheck={false}
      className={cn(
        "rounded-2xl border bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    />
  )
}
