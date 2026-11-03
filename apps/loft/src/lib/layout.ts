/** A screen's own glass panel; add a max width. */
export const screen = "glass mx-auto flex w-full flex-col gap-6 rounded-3xl p-6"

/** A card or list inside a glass panel. Glass isn't nested, so it's a fill. */
export const card = "overflow-hidden rounded-2xl bg-fill-1"

/** The height left for a full-screen editor under the `_authed` header: 100svh less its padding, gap and h-11 header. */
export const fullHeight =
  "h-[calc(100svh-6.125rem)] sm:h-[calc(100svh-6.75rem)]"
