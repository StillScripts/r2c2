import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"
import {
  VIEW_FADE_MS,
  type View,
  type ViewLayers,
  switchView,
  viewArt,
} from "@/lib/views"

const FRAME = "absolute bg-[#0b0e18]"

/** The view behind the Loft: the scene, a vignette and, on desktop, the window frame. */
export function LoftView({ view, dim }: { view: View; dim?: string }) {
  const [layers, setLayers] = useState<ViewLayers>({ shown: view })
  if (view !== layers.shown) setLayers(switchView(layers, view))

  useEffect(() => {
    if (!layers.leaving) return
    // A timer, not transitionend, which never fires when reduced motion cancels the fade
    const timer = setTimeout(
      () => setLayers(({ shown }) => ({ shown })),
      VIEW_FADE_MS
    )
    return () => clearTimeout(timer)
  }, [layers])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {[layers.shown, layers.leaving].map(
        (id) =>
          id && (
            <img
              key={id}
              src={viewArt(id)}
              alt=""
              className={cn(
                "absolute inset-0 size-full object-cover object-bottom",
                id === layers.leaving &&
                  "animate-out fill-mode-forwards fade-out"
              )}
              style={{ animationDuration: `${VIEW_FADE_MS}ms` }}
            />
          )
      )}
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_35%,transparent_55%,rgb(5_7_15/0.5)_100%)]" />
      {dim && <div className="absolute inset-0" style={{ background: dim }} />}
      <div className="hidden md:block">
        <div className={`${FRAME} inset-x-0 top-0 h-3.5`} />
        <div className={`${FRAME} inset-x-0 top-[22%] h-1.5 opacity-85`} />
        <div
          className={`${FRAME} inset-y-0 left-1/3 w-2.5 -translate-x-1/2 opacity-90`}
        />
        <div
          className={`${FRAME} inset-y-0 left-2/3 w-2.5 -translate-x-1/2 opacity-90`}
        />
        {/* A background, not an <img>, so phones never download it */}
        <div className="absolute -bottom-5 -left-7.5 h-85 w-75 bg-[url(/views/window-plant.svg)] bg-contain bg-no-repeat" />
      </div>
    </div>
  )
}
