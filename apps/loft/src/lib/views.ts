import type { Doc } from "@workspace/backend/dataModel"
import { Building2, type LucideIcon, MountainSnow, Waves } from "lucide-react"

export type View = Doc<"preferences">["view"]

/** How long the old view takes to fade out over the new one. */
export const VIEW_FADE_MS = 600

export const VIEWS: Record<View, { label: string; icon: LucideIcon }> = {
  harbour: { label: "Harbour", icon: Building2 },
  coast: { label: "Coast", icon: Waves },
  alps: { label: "Alps", icon: MountainSnow },
}

export const viewIds = Object.keys(VIEWS) as View[]

export const viewArt = (view: View) => `/views/${view}.svg`

/** The view on screen, and the one fading out over it after a switch. */
export type ViewLayers = { shown: View; leaving?: View }

/** Switch to `next`. Only the view being left fades out, so quick switches never stack. */
export const switchView = (layers: ViewLayers, next: View): ViewLayers =>
  next === layers.shown ? layers : { shown: next, leaving: layers.shown }
