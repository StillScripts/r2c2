import {
  type BuildFile,
  buildKey,
  liveKey,
  sha256Hex,
  versionKey,
} from "@workspace/core"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { DEPLOY_CLAIM_MS } from "./deploying"
import { addSite, errorCode, setup } from "../test/setup"
import { resetStorage, stored, writes } from "../test/storage"

vi.mock("./storage", () => import("../test/storage"))

const SHELL = `<!doctype html><html lang="en"><head><script type="module" src="./assets/index-AbC.js"></script><link rel="stylesheet" href="./assets/index-Dx9.css"></head><body><div id="app"></div></body></html>`

type Build = Record<string, string>

const VITE: Build = {
  "index.html": SHELL,
  "assets/index-AbC.js": "console.log('surf')",
  "assets/index-Dx9.css": "body{margin:0}",
}

const listOf = (build: Build) =>
  Promise.all(
    Object.entries(build).map(async ([path, body]): Promise<BuildFile> => ({
      path,
      bytes: new TextEncoder().encode(body).length,
      hash: await sha256Hex(body),
    }))
  )

async function appSite(kind: "app" | "pages" = "app") {
  const t = setup()
  return { t, siteId: await addSite(t, "surf", undefined, kind) }
}

type T = Awaited<ReturnType<typeof appSite>>["t"]

const start = async (t: T, build: Build) =>
  t.action(internal.apps.startDeploy, {
    slug: "surf",
    files: await listOf(build),
    actor: "ci",
  })

/** Start, upload what start asks for, and finish. */
async function deploy(t: T, siteId: Id<"sites">, build: Build) {
  const started = await start(t, build)
  if (!started.ok) throw new Error(started.errors.join("\n"))
  for (const { path } of started.uploads) {
    stored.set(buildKey(siteId, started.buildId, path), build[path]!)
  }
  const finished = await t.action(internal.apps.finishDeploy, {
    deployId: started.deployId,
  })
  return { started, finished }
}

const claims = (t: T) => t.run((ctx) => ctx.db.query("appClaims").collect())

beforeEach(resetStorage)

describe("startDeploy", () => {
  test("refuses a bad file list before claiming the site", async () => {
    const { t } = await appSite()
    const result = await start(t, { "app.js": "", "logo.svg": "" })
    expect(result).toEqual({
      ok: false,
      errors: [
        expect.stringContaining('"logo.svg" has a file type'),
        "A build needs an index.html at its root.",
      ],
    })
    expect(await claims(t)).toEqual([])
  })

  test("asks for every file of a new build", async () => {
    const { t, siteId } = await appSite()
    const result = await start(t, VITE)
    if (!result.ok) throw new Error(result.errors.join())
    expect(result.buildId).toMatch(/^[0-9a-f]{16}$/)
    expect(result.uploads).toEqual(
      Object.keys(VITE).map((path) => ({
        path,
        url: `https://r2.test/${buildKey(siteId, result.buildId, path)}`,
      }))
    )
  })

  test("only deploys to an existing app site", async () => {
    const pages = await appSite("pages")
    await expect(start(pages.t, VITE)).rejects.toThrow(errorCode("pages_site"))
    const { t } = await appSite()
    await expect(
      t.action(internal.apps.startDeploy, {
        slug: "nope",
        files: await listOf(VITE),
      })
    ).rejects.toThrow(errorCode("not_found"))
  })

  test("refuses a second deploy while the first holds the site", async () => {
    const { t } = await appSite()
    await start(t, VITE)
    await expect(start(t, VITE)).rejects.toThrow(errorCode("deploy_busy"))
  })

  test("takes over a claim that has expired", async () => {
    vi.useFakeTimers()
    try {
      const { t } = await appSite()
      await start(t, VITE)
      vi.advanceTimersByTime(DEPLOY_CLAIM_MS + 1)
      const again = await start(t, VITE)
      expect(again.ok).toBe(true)
      expect(await claims(t)).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("finishDeploy", () => {
  test("rewrites the shell, writes version and live copy, and records the build", async () => {
    const { t, siteId } = await appSite()
    const { started, finished } = await deploy(t, siteId, VITE)
    if (!started.ok) throw new Error()
    const { buildId } = started
    expect(finished).toEqual({ ok: true, buildId })

    const html = stored.get(liveKey(siteId, "/"))!
    expect(html).toContain(`src="/_build/${buildId}/assets/index-AbC.js"`)
    expect(html).toContain(`href="/_build/${buildId}/assets/index-Dx9.css"`)

    const [build] = await t.run((ctx) => ctx.db.query("appBuilds").collect())
    expect(build).toMatchObject({
      siteId,
      buildId,
      deployedBy: "ci",
      files: [
        {
          path: "index.html",
          bytes: SHELL.length,
          contentType: expect.stringMatching(/^text\/html/),
        },
        {
          path: "assets/index-AbC.js",
          bytes: 19,
          contentType: expect.stringMatching(/^text\/javascript/),
        },
        {
          path: "assets/index-Dx9.css",
          bytes: 14,
          contentType: expect.stringMatching(/^text\/css/),
        },
      ],
    })
    expect(writes.slice(-2)).toEqual([
      { key: versionKey(siteId, build!.htmlHash), metadata: undefined },
      { key: liveKey(siteId, "/"), metadata: { hash: build!.htmlHash } },
    ])
    expect(stored.get(versionKey(siteId, build!.htmlHash))).toBe(html)

    const site = await t.run((ctx) => ctx.db.get("sites", siteId))
    expect(site?.liveBuildId).toBe(build!._id)
    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(audit).toMatchObject([
      { siteId, actor: "ci", action: "app.deploy", target: buildId },
    ])
    expect(await claims(t)).toEqual([])
  })

  test("uploads nothing when the same build deploys twice", async () => {
    const { t, siteId } = await appSite()
    await deploy(t, siteId, VITE)
    const { started, finished } = await deploy(t, siteId, VITE)
    expect(started.ok && started.uploads).toEqual([])
    expect(finished.ok).toBe(true)
    const builds = await t.run((ctx) => ctx.db.query("appBuilds").collect())
    expect(builds).toHaveLength(1)
  })

  test("asks again only for files that are missing or the wrong size", async () => {
    const { t, siteId } = await appSite()
    const started = await start(t, VITE)
    if (!started.ok) throw new Error()
    const keyOf = (path: string) => buildKey(siteId, started.buildId, path)
    stored.set(keyOf("index.html"), SHELL)
    stored.set(keyOf("assets/index-AbC.js"), "short")

    const finished = await t.action(internal.apps.finishDeploy, {
      deployId: started.deployId,
    })
    expect(finished).toEqual({
      ok: false,
      errors: [
        '"assets/index-AbC.js" is 5 bytes, not the 19 listed.',
        `"assets/index-Dx9.css" wasn't uploaded.`,
      ],
    })
    expect(await claims(t)).toEqual([])
    expect(stored.has(liveKey(siteId, "/"))).toBe(false)

    const again = await start(t, VITE)
    expect(again.ok && again.uploads.map((upload) => upload.path)).toEqual([
      "assets/index-AbC.js",
      "assets/index-Dx9.css",
    ])
  })

  test("refuses a shell that breaks the app shell rules", async () => {
    const { t, siteId } = await appSite()
    const { finished } = await deploy(t, siteId, {
      ...VITE,
      "index.html": `<!doctype html>\n<html><head><script>boot()</script></head><body></body></html>`,
    })
    expect(finished).toEqual({
      ok: false,
      errors: [
        "index.html line 2: Scripts must load from a file in the build.",
      ],
    })
    expect(stored.has(liveKey(siteId, "/"))).toBe(false)
    expect(await claims(t)).toEqual([])
  })

  test("refuses a deploy whose claim is gone", async () => {
    const { t, siteId } = await appSite()
    const { started } = await deploy(t, siteId, VITE)
    if (!started.ok) throw new Error()
    await expect(
      t.action(internal.apps.finishDeploy, { deployId: started.deployId })
    ).rejects.toThrow(errorCode("deploy_expired"))
  })
})

describe("rollback", () => {
  test("puts an earlier build's HTML back live", async () => {
    const { t, siteId } = await appSite()
    const first = await deploy(t, siteId, VITE)
    await deploy(t, siteId, { ...VITE, "assets/index-AbC.js": "v2()" })
    if (!first.started.ok) throw new Error()
    const firstHtml = stored.get(
      versionKey(
        siteId,
        (await t.run((ctx) => ctx.db.query("appBuilds").first()))!.htmlHash
      )
    )

    await t.action(internal.apps.rollback, {
      slug: "surf",
      buildId: first.started.buildId,
    })
    expect(stored.get(liveKey(siteId, "/"))).toBe(firstHtml)
    const site = await t.run((ctx) => ctx.db.get("sites", siteId))
    const build = await t.run((ctx) =>
      ctx.db.get("appBuilds", site!.liveBuildId!)
    )
    expect(build?.buildId).toBe(first.started.buildId)
    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(audit.at(-1)).toMatchObject({
      actor: "system",
      action: "app.rollback",
      target: first.started.buildId,
    })
    expect(await claims(t)).toEqual([])
  })

  test("refuses a build the site never had", async () => {
    const { t } = await appSite()
    await expect(
      t.action(internal.apps.rollback, {
        slug: "surf",
        buildId: "0123456789abcdef",
      })
    ).rejects.toThrow(errorCode("not_found"))
  })
})
