import { z } from "zod"

export const routeEntrySchema = z.union([
  z.object({
    site: z.string().min(1),
    status: z.enum(["live", "coming-soon"]),
  }),
  z.object({ redirect: z.url() }),
])

export type RouteEntry = z.infer<typeof routeEntrySchema>
