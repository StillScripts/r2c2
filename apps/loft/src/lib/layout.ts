/** A screen's own glass panel; add a max width. */
export const screen = "glass mx-auto flex w-full flex-col gap-6 rounded-3xl p-6"

/** A full-height editor's glass panel, filling what the shell leaves below the header. */
export const editor = "glass flex min-h-0 flex-1 flex-col gap-3 rounded-3xl p-4"

/** A card or list inside a glass panel. Glass isn't nested, so it's a fill. */
export const card = "overflow-hidden rounded-2xl bg-fill-1"
