import { useBlocker } from "@tanstack/react-router"
import { useEffect, useEffectEvent } from "react"

/** Cmd/Ctrl+S calls `save`, and leaving with unsaved changes asks first. */
export function useEditorGuards({
  unsaved,
  save,
}: {
  unsaved: boolean
  save: () => void
}) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault()
      save()
    }
  })
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useBlocker({
    shouldBlockFn: () =>
      unsaved && !window.confirm("Leave without saving your changes?"),
    enableBeforeUnload: unsaved,
  })
}
