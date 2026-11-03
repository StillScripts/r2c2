import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

/** A glass panel on Home with an uppercase section title. */
export function HomePanel({
  id,
  title,
  className,
  children,
}: {
  id: string
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col rounded-3xl px-5 py-4.5 glass",
        className
      )}
    >
      <h2
        id={id}
        className="pb-2 text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
