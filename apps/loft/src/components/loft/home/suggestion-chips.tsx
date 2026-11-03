import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import type { Suggestion } from "@/lib/home"

/** Shortcuts to what's waiting. Once the conversation ships, each one sends its label. */
export function SuggestionChips({
  chips,
  onView = false,
}: {
  chips: Suggestion[]
  /** Straight on the view rather than inside the input's glass, so each chip is glass. */
  onView?: boolean
}) {
  if (chips.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
      {chips.map(({ label, link }) => (
        <li key={label}>
          <Link
            {...link}
            className={cn(
              "flex h-9 items-center rounded-full px-3.5 text-sm",
              onView ? "glass" : "bg-fill-2 hover:bg-fill-3"
            )}
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
