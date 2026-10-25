/** The draft as a standalone document for the preview iframe, with the compiled CSS in its head. */
export function previewDocument(html: string, css: string) {
  const style = `<style>${css}</style>`
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, (tag) => `${style}${tag}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${style}</head>`)
  }
  return `<!doctype html><html><head>${style}</head><body>${html}</body></html>`
}
