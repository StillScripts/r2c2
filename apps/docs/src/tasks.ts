import { getCollection, type CollectionEntry } from "astro:content"

export type Task = CollectionEntry<"tasks">

export const roadmapStatuses = [
  { id: "active", name: "Active" },
  { id: "waiting-on", name: "Waiting on" },
  { id: "someday", name: "Someday" },
]

export const statusOf = (task: Task) => task.id.split("/")[0]

export const slugOf = (task: Task) => task.id.split("/").at(-1)

export const formatDate = (date: Date) => date.toISOString().slice(0, 10)

export async function tasksIn(status: string) {
  const tasks = await getCollection("tasks", (t) => statusOf(t) === status)
  return tasks.sort(
    (a, b) =>
      a.data.created.getTime() - b.data.created.getTime() ||
      a.data.title.localeCompare(b.data.title, undefined, { numeric: true })
  )
}

export const previewOf = (task: Task) =>
  (task.body ?? "")
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
