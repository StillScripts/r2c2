import { describe, expect, it } from "vite-plus/test"
import { CLEAN_BODY, page } from "./fixtures"
import { assignElementIds } from "./ids"
import { SanitiserChangedPageError, sanitise } from "./sanitise"

describe("sanitise", () => {
  it("keeps a page that passes the house rules", () => {
    const html = assignElementIds(page(CLEAN_BODY))
    expect(sanitise(html)).toContain('<site-form name="contact"')
  })

  it.each([
    "<script>alert(1)</script>",
    '<p onclick="alert(1)">x</p>',
    '<p style="color:red">x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    "<svg><script>alert(1)</script></svg>",
    '<math><mtext><table><mglyph><style><img src=x onerror="alert(1)">',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    '<iframe src="https://evil.example"></iframe>',
    '<site-form name="c"><form action="https://evil.example"></form></site-form>',
    '<img src="https://cdn.example/a.png" alt="A">',
  ])("refuses to silently strip %s", (payload) => {
    expect(() => sanitise(page(payload))).toThrow(SanitiserChangedPageError)
  })
})
