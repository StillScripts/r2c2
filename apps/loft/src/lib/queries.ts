import { convexQuery } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"

export const meQuery = convexQuery(api.staff.me, {})
