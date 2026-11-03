import { cn } from "@workspace/ui/lib/utils"

/** A site's square badge in its own brand colour, or a neutral fill if its theme has none. */
export function SiteBadge({
  name,
  brand,
  className,
}: {
  name: string
  brand: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={brand ? { background: brand } : undefined}
      className={cn(
        "grid size-6.5 shrink-0 place-items-center rounded-[8px] bg-fill-3 text-[10px] font-bold text-white uppercase",
        className
      )}
    >
      {name.slice(0, 2)}
    </span>
  )
}
