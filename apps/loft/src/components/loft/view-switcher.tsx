import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import { cn } from "@workspace/ui/lib/utils"
import { VIEWS, type View, viewIds } from "@/lib/views"

/** A segmented control for the view. It switches at once and saves in the background. */
export function ViewSwitcher({ view }: { view: View }) {
  const setView = useConvexMutation(
    api.preferences.setView
  ).withOptimisticUpdate((store, { view }) => {
    const me = store.getQuery(api.staff.me, {})
    if (me) store.setQuery(api.staff.me, {}, { ...me, view })
  })

  return (
    <fieldset className="flex rounded-full bg-fill-1 p-1">
      <legend className="sr-only">View</legend>
      {viewIds.map((id) => {
        const { label, icon: Icon } = VIEWS[id]
        const selected = id === view
        return (
          <label
            key={id}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-lamp has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
              selected
                ? "bg-fill-selected"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <input
              type="radio"
              name="view"
              value={id}
              checked={selected}
              onChange={() => void setView({ view: id })}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
            <span className={cn(!selected && "sr-only sm:not-sr-only")}>
              {label}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
