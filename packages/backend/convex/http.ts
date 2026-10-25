import { ENQUIRY_INTAKE_PATH } from "@workspace/core"
import { httpRouter } from "convex/server"
import { authComponent, createAuth } from "./auth"
import { intake } from "./enquiries"

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)
http.route({ path: ENQUIRY_INTAKE_PATH, method: "POST", handler: intake })

export default http
