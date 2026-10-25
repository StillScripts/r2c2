/** The first few filled-in values, for a one-line preview in the inbox. */
export const summary = (data: Record<string, string>, count = 2) =>
  Object.values(data)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, count)
    .join(" · ")

/** The `utm_*` values without their prefix, like "source: newsletter, campaign: launch". */
export const campaign = (utm: Record<string, string>) =>
  Object.entries(utm)
    .map(([key, value]) => `${key.replace(/^utm_/, "")}: ${value}`)
    .join(", ")
