const words = (list: string) => list.trim().split(/\s+/)

export const PLATFORM_TAGS = ["site-form"]

export const ALLOWED_TAGS = [
  ...words(`
    html head body title meta
    header footer main nav section article aside
    div span p h1 h2 h3 h4 h5 h6 blockquote
    a strong em b i small br hr time address
    ul ol li dl dt dd
    table thead tbody tfoot tr th td caption
    figure figcaption img picture source
    form label input textarea select option button
  `),
  ...PLATFORM_TAGS,
]

export const GLOBAL_ATTRIBUTES = words(
  "class id data-r2c2-id role lang dir title aria-*"
)

export const TAG_ATTRIBUTES: Record<string, string[]> = {
  html: ["lang"],
  meta: ["charset", "name", "content"],
  a: ["href", "target", "rel"],
  img: ["src", "srcset", "sizes", "alt", "width", "height", "loading"],
  source: ["srcset", "sizes", "type", "media"],
  time: ["datetime"],
  th: ["scope", "colspan", "rowspan"],
  td: ["colspan", "rowspan"],
  form: ["method", "action"],
  label: ["for"],
  input: words(`
    name type value placeholder required maxlength
    minlength min max step pattern autocomplete
  `),
  textarea: ["name", "placeholder", "required", "maxlength", "rows"],
  select: ["name", "required"],
  option: ["value", "selected"],
  button: ["type"],
  "site-form": ["name"],
}

export const URL_ATTRIBUTES = ["href", "src", "srcset", "action"]
export const REQUEST_ATTRIBUTES = ["src", "srcset"]
export const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"]
export const MEDIA_PREFIX = "/assets/"
export const META_NAMES = ["description", "viewport"]

const matches = (allowed: string, name: string) =>
  allowed.endsWith("*")
    ? name.startsWith(allowed.slice(0, -1))
    : allowed === name

export const isAllowedAttribute = (tag: string, name: string) =>
  GLOBAL_ATTRIBUTES.some((allowed) => matches(allowed, name)) ||
  (TAG_ATTRIBUTES[tag]?.includes(name) ?? false)

const scheme = (url: string) =>
  url
    .replace(/[\s\p{Cc}]/gu, "")
    .toLowerCase()
    .match(/^([a-z][a-z0-9+.-]*):/)?.[1]

const urls = (name: string, value: string) =>
  name === "srcset"
    ? value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]!)
    : [value]

export type Problem = { rule: string; message: string }

function urlProblem(name: string, url: string): Problem | undefined {
  const protocol = scheme(url)
  if (protocol && !ALLOWED_SCHEMES.includes(protocol)) {
    return {
      rule: "allowed-urls",
      message: `${protocol}: URLs aren't allowed.`,
    }
  }
  if (REQUEST_ATTRIBUTES.includes(name) && !url.startsWith(MEDIA_PREFIX)) {
    return {
      rule: "site-media",
      message: `${url} isn't site media. Upload it and use its ${MEDIA_PREFIX} path.`,
    }
  }
  if (name === "action" && (protocol || url.startsWith("//"))) {
    return {
      rule: "allowed-urls",
      message: "Forms can only post to this site.",
    }
  }
}

export function attributeProblem(
  tag: string,
  name: string,
  value: string
): Problem | undefined {
  if (name.startsWith("on")) {
    return {
      rule: "no-inline-handlers",
      message: `Inline handlers like ${name} aren't allowed.`,
    }
  }
  if (name === "style") {
    return {
      rule: "no-style",
      message: "style attributes aren't allowed. Use theme classes.",
    }
  }
  if (!isAllowedAttribute(tag, name)) {
    return {
      rule: "allowed-attributes",
      message: `${name} isn't allowed on <${tag}>.`,
    }
  }
  if (tag === "meta" && name === "name" && !META_NAMES.includes(value)) {
    return {
      rule: "allowed-meta",
      message: `Only ${META_NAMES.join(" and ")} meta tags are allowed.`,
    }
  }
  if (URL_ATTRIBUTES.includes(name)) {
    for (const url of urls(name, value)) {
      const problem = urlProblem(name, url)
      if (problem) return problem
    }
  }
}
