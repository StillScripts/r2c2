import betterAuth from "@convex-dev/better-auth/convex.config"
import r2 from "@convex-dev/r2/convex.config.js"
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js"
import tableHistory from "@convex-dev/table-history/convex.config.js"
import { defineApp } from "convex/server"

const app = defineApp()
app.use(betterAuth)
app.use(r2)
app.use(rateLimiter)
app.use(tableHistory, { name: "pageHistory" })

export default app
