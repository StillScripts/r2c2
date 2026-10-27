import { execFileSync } from "node:child_process"

// Sets the production Workers' secrets from where each value already lives, so nobody
// copies one by hand (docs/deploy.md). Values pass through stdin and are never printed.

const root = new URL("../../../", import.meta.url)
const cwd = (dir: string) => new URL(dir, root)

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const run = (dir: string, args: string[], input?: string) =>
  execFileSync("vp", ["exec", ...args], {
    cwd: cwd(dir),
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "inherit"],
  }).trim()

const convexEnv = (name: string) =>
  run("packages/backend/", ["convex", "env", "get", "--prod", name]) ||
  fail(`${name} isn't set on the production Convex deployment.`)

const turnstileSecret = (sitekey: string) => {
  const widget = JSON.parse(
    run("apps/edge/", [
      "wrangler",
      "turnstile",
      "widget",
      "get",
      sitekey,
      "--json",
    ])
  ) as { secret?: string; result?: { secret?: string } }
  return (
    (widget.result ?? widget).secret ??
    fail(`The Turnstile widget ${sitekey} returned no secret.`)
  )
}

const cloudUrl = convexEnv("CONVEX_CLOUD_URL")
const siteUrl = convexEnv("CONVEX_SITE_URL")

const workers = [
  {
    name: "edge",
    dir: "apps/edge/",
    env: ["--env", "production"],
    secrets: {
      R2C2_SIGNING_SECRET: convexEnv("R2C2_SIGNING_SECRET"),
      TURNSTILE_SECRET: turnstileSecret(convexEnv("TURNSTILE_SITE_KEY")),
      CONVEX_SITE_URL: siteUrl,
    },
  },
  {
    name: "Loft",
    dir: "apps/loft/",
    env: [],
    secrets: { VITE_CONVEX_URL: cloudUrl, CONVEX_SITE_URL: siteUrl },
  },
]

for (const { name, dir, env, secrets } of workers) {
  run(dir, ["wrangler", "secret", "bulk", ...env], JSON.stringify(secrets))
  console.log(`Set ${Object.keys(secrets).join(", ")} on the ${name}`)
}
