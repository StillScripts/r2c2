/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as domains from "../domains.js";
import type * as enquiries from "../enquiries.js";
import type * as errors from "../errors.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as pages from "../pages.js";
import type * as preview from "../preview.js";
import type * as routes from "../routes.js";
import type * as seed from "../seed.js";
import type * as sites from "../sites.js";
import type * as staff from "../staff.js";
import type * as storage from "../storage.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  auth: typeof auth;
  domains: typeof domains;
  enquiries: typeof enquiries;
  errors: typeof errors;
  history: typeof history;
  http: typeof http;
  pages: typeof pages;
  preview: typeof preview;
  routes: typeof routes;
  seed: typeof seed;
  sites: typeof sites;
  staff: typeof staff;
  storage: typeof storage;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  pageHistory: import("@convex-dev/table-history/_generated/component.js").ComponentApi<"pageHistory">;
};
