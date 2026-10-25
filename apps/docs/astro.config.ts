import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import { syncContent } from "./src/sync-content"

export default defineConfig({
  integrations: [
    syncContent(),
    starlight({
      title: "R2C2",
      description: "React + R2, Convex + Cloudflare.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/StillScripts/r2c2",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/StillScripts/r2c2/edit/master/apps/docs/",
      },
      customCss: ["@fontsource-variable/inter", "./src/styles/custom.css"],
      sidebar: [
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        {
          label: "Roadmap",
          items: [
            { label: "Up next", link: "/roadmap/" },
            { label: "Completed", link: "/roadmap/completed/" },
          ],
        },
        {
          label: "Plans",
          collapsed: true,
          items: [{ autogenerate: { directory: "plans" } }],
        },
        {
          label: "Decisions",
          collapsed: true,
          items: [{ autogenerate: { directory: "decisions" } }],
        },
      ],
    }),
  ],
})
