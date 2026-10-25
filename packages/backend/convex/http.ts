import { ENQUIRY_INTAKE_PATH } from "@workspace/core"
import { httpRouter } from "convex/server"
import { intake } from "./enquiries"

const http = httpRouter()
http.route({ path: ENQUIRY_INTAKE_PATH, method: "POST", handler: intake })

export default http
