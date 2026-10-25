export const builtInPage = (title: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body><h1>${title}</h1></body></html>`

export const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  })

export async function withoutBody(
  source: { body: ReadableStream | null },
  init: ResponseInit
) {
  await source.body?.cancel()
  return new Response(null, init)
}
