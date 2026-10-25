import { Resend } from "@convex-dev/resend"
import { v } from "convex/values"
import { components } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import { authComponent } from "./auth"
import { isEmail } from "./enquiries"

/** Resend's inbox for test sends, used for every notification while test mode is on. */
export const TEST_INBOX = "delivered@resend.dev"

/** On unless `RESEND_TEST_MODE` is `false`, so dev never emails real owners. */
const testMode = () => process.env.RESEND_TEST_MODE !== "false"

/** The subject and plain-text body of a new-enquiry email. */
export function enquiryEmailText(
  site: Pick<Doc<"sites">, "_id" | "name">,
  enquiry: Pick<Doc<"enquiries">, "form" | "data" | "source" | "createdAt">,
  loftUrl: string | undefined
) {
  const lines = [
    `New enquiry from the "${enquiry.form}" form on ${site.name}.`,
    "",
    ...Object.entries(enquiry.data).map(([name, value]) => `${name}: ${value}`),
    "",
    ...(enquiry.source ? [`Page: ${enquiry.source.page}`] : []),
    `Received: ${new Date(enquiry.createdAt).toUTCString()}`,
    ...(loftUrl ? [`See it in the Loft: ${loftUrl}/sites/${site._id}`] : []),
  ]
  return {
    subject: `New enquiry on ${site.name}: ${enquiry.form}`,
    text: lines.join("\n"),
  }
}

/** Email a site's owners about one enquiry, at most once. */
export const enquiryEmail = internalMutation({
  args: { enquiryId: v.id("enquiries") },
  handler: async (ctx, { enquiryId }) => {
    const enquiry = await ctx.db.get("enquiries", enquiryId)
    const site = enquiry && (await ctx.db.get("sites", enquiry.siteId))
    if (!enquiry || !site) return

    const from = process.env.EMAIL_FROM
    if (!from) {
      console.warn("EMAIL_FROM isn't set, so no enquiry email was sent")
      return
    }
    const owners = (
      await ctx.db
        .query("memberships")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .collect()
    ).filter((m) => m.role === "owner")
    const users = await Promise.all(
      owners.map((m) => authComponent.getAnyUserById(ctx, m.userId))
    )
    const emails = users.flatMap((user) => (user ? [user.email] : []))
    if (emails.length === 0) return

    const test = testMode()
    const { subject, text } = enquiryEmailText(
      site,
      enquiry,
      process.env.SITE_URL
    )
    const visitor = enquiry.data.email
    await new Resend(components.resend, { testMode: test }).sendEmail(ctx, {
      from,
      to: test ? TEST_INBOX : emails,
      subject,
      text: test ? `${text}\n\n(Test mode: for ${emails.join(", ")})` : text,
      ...(visitor && isEmail(visitor) && { replyTo: [visitor.trim()] }),
      idempotencyKey: `enquiry:${enquiryId}`,
    })
  },
})
