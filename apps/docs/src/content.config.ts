import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"
import { docsLoader } from "@astrojs/starlight/loaders"
import { docsSchema } from "@astrojs/starlight/schema"

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  tasks: defineCollection({
    loader: glob({ pattern: "*/*.md", base: "./src/content/tasks" }),
    schema: z.object({
      title: z.string(),
      created: z.coerce.date(),
      completed: z.coerce.date().optional(),
      plan: z.string().optional(),
    }),
  }),
}
