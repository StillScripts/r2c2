import { describe, expect, it } from "vite-plus/test"
import { MAX_PAGE_BYTES } from "@workspace/core"
import { checkPage } from "./check"
import { CLEAN_BODY, page, THEME } from "./fixtures"
import { formatIssue } from "./issues"
import { loadTheme } from "./theme"

const theme = await loadTheme(THEME)
const check = (body: string, head?: string) =>
  checkPage(page(body, head), theme)

describe("checkPage", () => {
  it("passes a clean page", async () => {
    expect(await check(CLEAN_BODY)).toEqual({
      errors: [],
      warnings: [],
      forms: [
        {
          name: "contact",
          fields: [
            { name: "email", type: "email", required: true, maxLength: 200 },
          ],
        },
      ],
    })
  })

  it("allows code, preformatted text and sub and superscripts", async () => {
    const body = `<h1>R<sub>2</sub>C<sup>2</sup></h1>
<p>Add <code>&lt;site-form&gt;</code> to a page.</p><pre>HTTP/2 200</pre>`
    expect((await check(body)).errors).toEqual([])
  })

  it.each([
    ["allowed-tags", "<iframe></iframe>", "<iframe> isn't allowed."],
    ["allowed-tags", "<svg></svg>", "<svg> isn't allowed."],
    [
      "no-inline-handlers",
      '<p onclick="go()">x</p>',
      "Inline handlers like onclick aren't allowed.",
    ],
    [
      "no-style",
      '<p style="color:red">x</p>',
      "style attributes aren't allowed. Use theme classes.",
    ],
    ["allowed-attributes", "<p hidden>x</p>", "hidden isn't allowed on <p>."],
    [
      "allowed-urls",
      '<a href="javascript:go()">Our services</a>',
      "javascript: URLs aren't allowed.",
    ],
    [
      "allowed-urls",
      '<a href=" JAVA\tSCRIPT:go()">Our services</a>',
      "javascript: URLs aren't allowed.",
    ],
    [
      "allowed-urls",
      '<site-form name="c"><form action="https://evil.example"></form></site-form>',
      "Forms can only post to this site.",
    ],
    [
      "site-media",
      '<img src="https://cdn.example/a.png" alt="A">',
      "https://cdn.example/a.png isn't site media. Upload it and use its /assets/ path.",
    ],
    [
      "allowed-urls",
      '<img src="data:image/png;base64,AAAA" alt="A">',
      "data: URLs aren't allowed.",
    ],
    [
      "site-media",
      '<picture><source srcset="/assets/a.webp 1x, //cdn.example/b.webp 2x"><img src="/assets/a.png" alt="A"></picture>',
      "//cdn.example/b.webp isn't site media. Upload it and use its /assets/ path.",
    ],
    [
      "img-alt",
      '<img src="/assets/a.png" alt=" ">',
      "Images need alt text describing them.",
    ],
    [
      "link-text",
      '<a href="/about">Click here</a>',
      "Link text should say where the link goes.",
    ],
    [
      "no-url",
      '<p class="bg-[url(/assets/a.png)]">x</p>',
      "bg-[url(/assets/a.png)] isn't allowed. Images come from the site's media.",
    ],
    [
      "no-url",
      '<p class="md:[background:url(x)]">x</p>',
      "md:[background:url(x)] isn't allowed. Images come from the site's media.",
    ],
    [
      "site-form",
      '<site-form name="c"><form><label for="a">A</label><input id="a"></form></site-form>',
      "Fields in a form need a name attribute.",
    ],
    [
      "heading-level",
      "<h1>One</h1><h3>Three</h3>",
      "Heading level can only increase by one, expected <h2> but got <h3>.",
    ],
    [
      "heading-level",
      "<h1>One</h1><h1>Two</h1>",
      "Multiple <h1> are not allowed.",
    ],
    [
      "input-missing-label",
      '<site-form name="c"><form><input name="a"></form></site-form>',
      "<input> element does not have a <label>.",
    ],
    [
      "wcag/h30",
      '<a href="/about"></a>',
      "Anchor link must have a text describing its purpose.",
    ],
  ])("reports %s for %s", async (rule, body, message) => {
    const withTitle = body.includes("<h1") ? body : `<h1>Title</h1>\n${body}`
    const { errors } = await check(withTitle)
    expect(errors).toContainEqual(expect.objectContaining({ rule, message }))
  })

  it("points at the line and column of the problem", async () => {
    const { errors } = await check(
      '<h1>Title</h1>\n<p>ok</p>\n  <p class="bg-[url(x)]">x</p>'
    )
    expect(errors).toEqual([
      {
        line: 5,
        column: 3,
        rule: "no-url",
        message:
          "bg-[url(x)] isn't allowed. Images come from the site's media.",
      },
    ])
    expect(formatIssue(errors[0]!)).toBe(
      "Line 5: bg-[url(x)] isn't allowed. Images come from the site's media."
    )
  })

  it("allows arbitrary values", async () => {
    const body = `<h1 class="text-[2.5rem] tracking-[-0.02em]">Title</h1>
<p class="bg-[#1f5b8a] grid-cols-[1fr_2fr] md:hover:[color:red] bg-(--color-brand)">x</p>`
    expect(await check(body)).toMatchObject({ errors: [], warnings: [] })
  })

  it("warns about classes the theme can't compile without blocking", async () => {
    const { errors, warnings } = await check(
      '<h1>Title</h1>\n<p class="js-toggle">x</p>\n<p class="bg-red-500">y</p>'
    )
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      {
        line: 4,
        column: 1,
        rule: "unknown-class",
        message:
          "js-toggle doesn't match anything in this site's theme, so it has no effect.",
      },
      {
        line: 5,
        column: 1,
        rule: "unknown-class",
        message:
          "bg-red-500 doesn't match anything in this site's theme, so it has no effect.",
      },
    ])
  })

  it("allows Tailwind's defaults when the theme doesn't reset them", async () => {
    const plain = await loadTheme("")
    const body = `<h1 class="text-gray-900 font-serif">Title</h1>
<div class="bg-slate-900 rounded-lg shadow-md p-6"><p class="text-white">x</p></div>`
    expect(await checkPage(page(body), plain)).toMatchObject({
      errors: [],
      warnings: [],
    })
  })

  it.each([
    [
      "page-title",
      '<meta name="description" content="d">',
      "The page needs one non-empty <title>.",
    ],
    [
      "page-title",
      '<title> </title><meta name="description" content="d">',
      "The page needs one non-empty <title>.",
    ],
    [
      "page-description",
      "<title>T</title>",
      'The page needs one non-empty <meta name="description">.',
    ],
    [
      "allowed-meta",
      '<title>T</title><meta name="description" content="d"><meta name="robots" content="none">',
      "Only description and viewport meta tags are allowed.",
    ],
  ])("checks page metadata: %s", async (rule, head, message) => {
    const { errors } = await check("<h1>Title</h1>", head)
    expect(errors).toContainEqual(expect.objectContaining({ rule, message }))
  })

  it("requires a head", async () => {
    const draft = `<html lang="en"><body><title>T</title><meta name="description" content="d"><h1>Title</h1></body></html>`
    const { errors } = await checkPage(draft, theme)
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "page-head" })
    )
  })

  it("limits the page size", async () => {
    const { errors } = await check(
      `<h1>Title</h1><p>${"a".repeat(MAX_PAGE_BYTES)}</p>`
    )
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "page-size" })
    )
  })

  it("warns about long utility strings without a component class", async () => {
    const utilities =
      "flex p-4 m-2 gap-2 text-ink bg-paper font-sans rounded-card items-center"
    const { errors, warnings } = await check(
      `<h1>Title</h1><div class="${utilities}">x</div>`
    )
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      expect.objectContaining({ rule: "prefer-components" }),
    ])
    expect(
      (await check(`<h1>Title</h1><div class="card ${utilities}">x</div>`))
        .warnings
    ).toEqual([])
  })
})
