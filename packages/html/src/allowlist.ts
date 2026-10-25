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

export function isAllowedAttribute(tag: string, name: string) {
  return [...GLOBAL_ATTRIBUTES, ...(TAG_ATTRIBUTES[tag] ?? [])].some(
    (allowed) =>
      allowed.endsWith("*")
        ? name.startsWith(allowed.slice(0, -1))
        : allowed === name
  )
}
