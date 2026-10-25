---
title: T20 Send email notifications
depth: simple
created: 2026-10-25
---

# T20 Send email notifications

Email a site's owners about each new enquiry, through `@convex-dev/resend`. Enquiry
intake (`enquiries:receive`) schedules a notification after it stores an enquiry. The
notification looks up the site's owners and enqueues one plain-text email through the
Resend component, which handles retries and Resend's rate limits.

## Scope

- In:
  - pin `@convex-dev/resend` 0.2.10 and install it as a component;
  - `convex/notifications.ts`: `resend = new Resend(components.resend, { testMode })` and
    an internal mutation `enquiryEmail({ enquiryId })` that:
    - loads the enquiry and site, and the owners' emails from Better Auth
      (`getAnyUserById`);
    - enqueues one email to all owners;
    - is idempotent per enquiry (`idempotencyKey: enquiry:<id>`), so a retried schedule
      never sends twice;
  - **the email:**
    - subject `New enquiry on <site name>: <form>`;
    - a plain-text body with each field, the page it came from, the time, and a link to
      the site in the Loft (`SITE_URL/sites/<id>`);
    - `Reply-To` set to the enquiry's `email` field, when it holds a valid address, so
      the owner can reply directly;
  - `receive` schedules it with `ctx.scheduler.runAfter(0, …)` after the insert. A
    Resend failure can then never lose the enquiry. Duplicates, refusals and rate-limited
    posts send nothing;
  - **env:**
    - `RESEND_API_KEY` is already listed in SPEC §8;
    - new `EMAIL_FROM`, the sender, from a domain verified in Resend;
    - new `RESEND_TEST_MODE`, on unless set to `false`. In test mode, mail goes to
      Resend's test inbox `delivered@resend.dev` instead of the owners, and the body
      names the intended recipients. That's how dev meets the "done when";
  - `convex-test` with the component's `/test` export, the backend README, SPEC §8 and
    `.env.example`.
- Out:
  - emailing editors;
  - per-member notification settings;
  - HTML or branded emails;
  - Resend's delivery webhook (bounces and complaints);
  - the Loft inbox (T17), so the link goes to the site's page in the Loft until T17
    exists.

## Action items

- [x] Pin `@convex-dev/resend` in the catalog, add it to `packages/backend`, register it
      in `convex.config.ts` and `test/setup.ts`, and add it to `_generated/api.d.ts`.
- [x] Add `convex/notifications.ts`: the `resend` client, `enquiryEmail`, and a pure
      `enquiryEmailText(site, enquiry)` for the subject and body.
- [x] Schedule `enquiryEmail` from `enquiries:receive` after the insert.
- [x] Tests:
  - a stored enquiry schedules one notification;
  - a duplicate or a refused post schedules none;
  - the notification enqueues one email to the owners (or to the test inbox in test
    mode), with `Reply-To` from a valid `email` field and none from an invalid one;
  - running it twice for one enquiry enqueues once;
  - the body lists the fields and source.
- [x] Document `EMAIL_FROM` and `RESEND_TEST_MODE` in SPEC §8, the backend `.env.example`
      and README.
- [x] Run `vp check`, `vp test` and `vp run build`.

## As built

- `notifications.ts` creates the Resend client inside the mutation, so test mode follows
  the environment at send time rather than at module load.
- Without `EMAIL_FROM` the notification logs a warning and sends nothing, like route
  syncs without Cloudflare credentials.
- Reply-To comes from `receive`, not from a field named `email`. Intake takes the first
  of the form's `type="email"` fields, which it has already validated, and passes it to
  the scheduled notification, so forms that call the field `your_email` work too.
- The tests spy on `Resend.prototype.sendEmail`. They check the idempotency key, not
  the component's dedupe itself, which the component owns.

## Open questions

- Owners only, or every member (editors too)? This plan assumes owners only, since SPEC
  says "the site owner".
- The sender address needs a verified domain, and the marketing domain isn't picked yet.
  Dev can use Resend's `onboarding@resend.dev` as `EMAIL_FROM`.
