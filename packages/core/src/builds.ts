import { HASH_LENGTH, sha256Hex } from "./hash"
import { BUILD_CONTENT_TYPES, buildFileType, HTML_CONTENT_TYPE } from "./urls"

export const BUILD_SHELL = "index.html"
export const MAX_BUILD_FILE_BYTES = 10 * 1024 * 1024
export const MAX_BUILD_BYTES = 50 * 1024 * 1024
export const MAX_BUILD_FILES = 1000
export const MAX_BUILD_PATH_LENGTH = 256

/** One file of an app build: its path inside the build, size, and full SHA-256 in hex. */
export type BuildFile = { path: string; bytes: number; hash: string }

// Characters a URL path carries unencoded, so the served path is the stored key
const SEGMENT = /^[A-Za-z0-9_@+~.-]+$/
const SHA256 = /^[0-9a-f]{64}$/

/** The content type a build file is stored with, or undefined if builds can't hold it. */
export const buildContentType = (path: string) =>
  path === BUILD_SHELL ? HTML_CONTENT_TYPE : buildFileType(path)

function pathProblem(path: string) {
  if (path.length > MAX_BUILD_PATH_LENGTH) {
    return `is over ${MAX_BUILD_PATH_LENGTH} characters.`
  }
  const segments = path.split("/")
  if (segments.some((s) => !SEGMENT.test(s) || s === "." || s === "..")) {
    return "isn't a relative path of letters, numbers and _ @ + ~ . - only."
  }
  if (!buildContentType(path)) {
    return `has a file type builds can't hold. Use ${Object.keys(BUILD_CONTENT_TYPES).join(", ")}; the only HTML is the root ${BUILD_SHELL}.`
  }
  return null
}

const megabytes = (bytes: number) => `${bytes / 1024 / 1024} MB`

/** Every reason the file list can't be deployed, as readable messages; empty when it can. */
export function buildFileProblems(files: BuildFile[]) {
  const problems: string[] = []
  const seen = new Set<string>()
  let total = 0
  if (files.length > MAX_BUILD_FILES) {
    problems.push(`A build can have at most ${MAX_BUILD_FILES} files.`)
  }
  for (const { path, bytes, hash } of files) {
    const problem = pathProblem(path)
    if (problem) problems.push(`"${path}" ${problem}`)
    if (seen.has(path)) problems.push(`"${path}" is listed twice.`)
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      problems.push(`"${path}" has an invalid size.`)
    } else if (bytes > MAX_BUILD_FILE_BYTES) {
      problems.push(`"${path}" is over ${megabytes(MAX_BUILD_FILE_BYTES)}.`)
    }
    if (!SHA256.test(hash)) {
      problems.push(`"${path}" needs its SHA-256 as 64 lowercase hex digits.`)
    }
    seen.add(path)
    total += bytes
  }
  if (!seen.has(BUILD_SHELL)) {
    problems.push(`A build needs an ${BUILD_SHELL} at its root.`)
  }
  if (total > MAX_BUILD_BYTES) {
    problems.push(`The build is over ${megabytes(MAX_BUILD_BYTES)}.`)
  }
  return problems
}

/**
 * The build's ID: the first 16 hex characters of a SHA-256 over its sorted paths and
 * file hashes, so the same files always get the same ID (ADR-020).
 */
export async function buildIdOf(files: BuildFile[]) {
  const lines = files.map(({ path, hash }) => `${path}\n${hash}\n`).sort()
  return (await sha256Hex(lines.join(""))).slice(0, HASH_LENGTH)
}
