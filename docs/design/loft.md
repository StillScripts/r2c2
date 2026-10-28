# The Loft design spec

How the Loft should look and behave from here on: a calm, conversation-first place to run your sites, set against a view out the window. This is the reference for every Loft UI task. It is written to be built from directly, so values here are exact unless marked _suggested_.

- **Source:** the "The Loft — Concepts" canvas in Claude Design, page "Talk to it" (private to Daniel).
- **Reference markup:** [`loft/reference/`](loft/reference/) holds the canvas source for every screen. See [Reading the reference files](#13-reading-the-reference-files).
- **Scenes:** [`loft/views/`](loft/views/) holds the three views as standalone SVG.
- **Status:** draft, 28 October 2026.

Related: [ADR-017](../decisions/ADR-017-call-loft-scenes-views.md) (views, not themes), [SPEC §1](../../SPEC.md#1-milestone-1) (the Loft should feel calm), [SPEC §11](../../SPEC.md#11-later-specs-outlines) (AI editing), [SPEC §12](../../SPEC.md#12-html-house-rules) (house rules).

## 1. What the Loft is now

You talk or type, and the Loft does the work. The AI creates new pages and changes existing ones as **drafts, in the background**. You see what changed in plain words, preview it, and publish it with one press. The HTML editor stays, but it's a way out ("Open the HTML"), not the way in.

The first version needs two things:

1. **The views shell**: the glass look and the Harbour, Coast and Alps views, with today's screens moved inside it.
2. **The AI interface**: a conversation that generates and updates HTML, with results you can preview and publish.

Not now: MCP and the Connect screen (§11), team members, and custom or uploaded views.

## 2. Principles

1. **Always talking or typing.** One input, always in view: centred on Home, docked at the bottom in a conversation and on a phone. The mic is the brightest thing on the screen.
2. **Work happens in the background.** No editing chrome by default. Results arrive as cards in the conversation, and long jobs move to a background list and report back.
3. **Nothing goes live without you.** The AI only ever writes drafts. Publishing is always a press of a Publish button, never something the AI does on its own.
4. **Say what happened, not how.** Write "Published /pricing" and "2 new enquiries". Never show tool names (`edit_element`), the assistant that did it, or protocol words like MCP. Whatever acts on your behalf is just you.
5. **A place, not a dashboard.** A view behind everything, generous space, no grids of numbers, and one primary (lamp) action per surface.
6. **Calm motion.** Slow breathing and soft glows. Nothing bounces or spins, and everything stops under reduced motion.

## 3. Vocabulary

| Term           | Means                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| View           | The scene behind the Loft: **Harbour**, **Coast** or **Alps**. A per-user preference. Not the same as a site's **theme** (its Tailwind tokens, SPEC §6), which never changes here. |
| Concierge      | The AI in the Loft. The name is tentative (§14).                                                                                                                                   |
| Draft          | Unpublished changes to a page. Drafts save as you go, so there is no Save step in the new screens.                                                                                 |
| Result card    | What the AI returns after changing something: a thumbnail, what changed, and Preview and Publish.                                                                                  |
| Background job | Work that takes more than a few seconds (translating a page, checking every link). It is listed in the background panel and reports back when done.                                |
| Activity       | The "Lately" list: past events on your sites, written as outcomes.                                                                                                                 |

## 4. Visual language

### 4.1 Colour

Everything sits on dark glass over the view, so the Loft has one colour scheme and no light or dark toggle. The view is the mode.

| Token (_suggested_ name) | Value                    | Use                                                                                  |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| `ground`                 | `#10152a`                | Page background behind the view, shown while the view loads                          |
| `text`                   | `#f4f5f9`                | Primary text on glass                                                                |
| `text-muted`             | `#cdd1db`                | Labels, metadata, secondary text on glass                                            |
| `text-placeholder`       | `#b9bfcc`                | Input placeholders                                                                   |
| `text-unheard`           | `#a9afbd`                | The tail of a voice transcript still being recognised                                |
| `lamp`                   | `#ffc46b`                | The primary action (Publish, mic, Go ahead), working dots, progress bars, focus ring |
| `lamp-ink`               | `#1d1505`                | Text and icons on lamp                                                               |
| `lamp-text`              | `#ffd08a`                | Amber text on dark glass (links, step numbers, the "Listening" label)                |
| `lamp-soft`              | `#ffe3b8`                | Text inside lamp-tinted notes; link hover                                            |
| `lamp-tint`              | `rgba(255,196,107,0.12)` | Note backgrounds ("I'll need prices…"). Use 0.18–0.2 for a lamp chip                 |
| `live`                   | `#6ee7a8`                | Live status dots, success checks                                                     |
| `live-text`              | `#b9f5d4`                | "Live" and "House rules pass" text                                                   |
| `live-tint`              | `rgba(110,231,168,0.2)`  | Live and success icon chips (0.1 for a success panel, with a 0.25 border)            |
| `removed-text`           | `#ffb3a7`                | Struck-out old text in a before/after line                                           |
| `fill-1`                 | `rgba(255,255,255,0.08)` | Rows and cards inside glass; dividers use the same value                             |
| `fill-2`                 | `rgba(255,255,255,0.12)` | Chips, secondary buttons                                                             |
| `fill-3`                 | `rgba(255,255,255,0.14)` | Secondary buttons on glass (Preview), user bubbles on a phone                        |
| `fill-selected`          | `rgba(255,255,255,0.2)`  | The selected segment in a segmented control                                          |
| `avatar`                 | `#e9d7c0` on `#2a1d10`   | The user's initials                                                                  |

A site's badge (the "R2" square) uses that site's own brand colour from its theme (`#2f3bff` for R2C2), not a Loft colour.

Contrast: every text colour above passes 4.5:1 on dark glass over the brightest view (the Coast sky). The glass opacity in §4.2 is what makes that true, so don't lower it.

### 4.2 Materials

| Material     | CSS                                                                                                                                                                                                       | Use                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Glass        | `background: rgba(13,16,27,0.66); border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(24px) saturate(150%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 60px rgba(3,5,12,0.35)`  | Every panel, pill, bubble and input that holds text                      |
| Bright glass | `background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(20px) saturate(170%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 30px 70px rgba(3,5,12,0.4)` | Frames around a page preview only. Never put text directly on it         |
| Lamp         | `background: #ffc46b; color: #1d1505; box-shadow: 0 0 0 1px rgba(255,214,150,0.6), 0 8px 30px rgba(255,180,80,0.45)`                                                                                      | The single primary action on a surface, and the mic                      |
| Text on view | `text-shadow: 0 2px 24px rgba(6,20,30,0.6)`                                                                                                                                                               | Any text placed straight on the view (the greeting and the summary line) |

Rules:

- **Don't nest blur.** Glass inside glass uses a `fill-*` colour, not another `backdrop-filter`. It's cheaper to render and looks cleaner.
- **Dim the view, don't change the glass.** Screens that need more focus add a full-screen dim layer over the view: Home `rgba(8,22,34,0.2)`, conversation none, voice `rgba(6,9,20,0.5)`, publish sheet `rgba(5,7,16,0.42)`.
- **Fallbacks.** Under `prefers-reduced-transparency: reduce`, or when `backdrop-filter` isn't supported, glass becomes solid `#161a2a` with the same border.

### 4.3 Type

Three families, all self-hosted (the Loft follows the same no-third-party rule as published pages):

- **Archivo**: UI and body. It's also the R2C2 site's font.
- **Instrument Serif**: greetings, screen titles, sheet titles, voice transcripts and the "The Loft" wordmark. Use it for a few words at a time, never for UI text.
- **JetBrains Mono**: paths (`/pricing`), addresses, times and dates in pills.

Install with `@fontsource` (the Loft already uses `@fontsource-variable/inter`). Check the exact package names when installing: the variable packages exist for Archivo and JetBrains Mono, and Instrument Serif is static (400, plus italic).

| Role             | Family / weight        | Desktop               | Phone   |
| ---------------- | ---------------------- | --------------------- | ------- |
| Greeting         | Serif 400              | 84px / 0.95, −0.01em  | 52px    |
| Screen title     | Serif 400              | 64px / 1              | —       |
| Sheet title      | Serif 400              | 38px / 1              | 34px    |
| Voice transcript | Serif 400              | 44px / 1.15           | 34px    |
| Wordmark         | Serif 400              | 24–26px               | 22px    |
| Summary line     | Archivo 400            | 20px / 1.45           | 16px    |
| Core input text  | Archivo 400            | 24px (docked: 17px)   | 18px    |
| Body             | Archivo 400            | 15px / 1.5            | 14px    |
| Button           | Archivo 500; lamp 600  | 14px (large: 16px)    | 14px    |
| Section label    | Archivo 600, uppercase | 13px, +0.08em         | 12px    |
| Metadata         | Archivo 400            | 12–13px, `text-muted` | 12px    |
| Mono             | JetBrains Mono 400     | 11–13px               | 11–12px |

### 4.4 Shape and spacing

- **Radii:** pills and round buttons `999px`. Core input `32px` (phone `28px`). Panels and bubbles `22–26px`. Cards inside panels `14–16px`. Thumbnails `8–10px`. Bubbles flatten the corner nearest the speaker to `6px`: `22px 22px 6px 22px` for you, `22px 22px 22px 6px` for the Concierge. If you remap shadcn's radius scale, `--radius: 1rem` lands close to these steps.
- **Page padding:** desktop `22px 24px`, phone `20px 16px 18px`.
- **Gaps:** 6 and 8 inside controls, 10 to 14 inside panels, 16 to 22 between panels.
- **Touch targets:** at least 44px everywhere. Pills and header buttons are 44px tall, and the mic is 64–68px (56 when docked, 52 on the phone dock).
- **Content widths:** Home column 1040px max, conversation column 760px max with a 300px side panel, docked input 820px max.

### 4.5 Icons

Use `lucide-react`, which `packages/ui` already depends on, at 1.8 stroke with round caps and joins. Size 16–18 in controls, 22–28 in the mic.

| Meaning                | Lucide                                 |
| ---------------------- | -------------------------------------- |
| Talk                   | `Mic`                                  |
| Preview                | `Eye`                                  |
| Publish, live          | `Globe`                                |
| Concierge              | `ConciergeBell`                        |
| Enquiries              | `Inbox`                                |
| Draft                  | `File`                                 |
| History                | `History`                              |
| Attach                 | `Paperclip`                            |
| Add a photo (phone)    | `Camera`                               |
| Send                   | `ArrowUp`                              |
| Done                   | `Check`                                |
| Close or cancel        | `X`                                    |
| Open the HTML          | `Code`                                 |
| Harbour / Coast / Alps | `Building2` / `Waves` / `MountainSnow` |

The Loft mark is custom: a roof, walls and a four-pane window, stroked in `lamp`. See any header in the reference files.

### 4.6 Motion

| Name        | What                                                                        | Where                                           |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Breathe     | `box-shadow` ring 0 → 6px fading to transparent, 2.4s ease-in-out, infinite | Working dots, the background-jobs pill          |
| Wave        | Bars `scaleY(0.45 → 1)`, 1.1s ease-in-out, staggered 0.11s per bar          | The voice orb while listening                   |
| Halo        | Radial lamp glow `scale(1 → 1.1)`, opacity 0.55 → 0.9, 3s                   | Behind the voice orb                            |
| Thinking    | Three 6px dots, opacity 0.3 → 1, 1.2s, staggered 0.2s                       | Next to a plain label ("Reading the enquiries") |
| View change | Cross-fade the old view out over the new one, 600ms (_suggested_)           | Switching views                                 |

Everything above stops under `prefers-reduced-motion: reduce`.

### 4.7 Proposed tokens (_suggested_)

Remap shadcn's semantic tokens so existing components pick up the look, and add a few utilities for what shadcn doesn't cover. Here's one way to do it in `packages/ui/src/styles/`:

```css
:root {
  --background: #10152a;
  --foreground: #f4f5f9;
  --card: rgba(13, 16, 27, 0.66);
  --card-foreground: #f4f5f9;
  --popover: rgba(13, 16, 27, 0.8);
  --popover-foreground: #f4f5f9;
  --primary: #ffc46b;
  --primary-foreground: #1d1505;
  --secondary: rgba(255, 255, 255, 0.14);
  --secondary-foreground: #f4f5f9;
  --muted: rgba(255, 255, 255, 0.08);
  --muted-foreground: #cdd1db;
  --accent: rgba(255, 255, 255, 0.2);
  --accent-foreground: #f4f5f9;
  --border: rgba(255, 255, 255, 0.14);
  --input: rgba(255, 255, 255, 0.14);
  --ring: #ffc46b;
  --radius: 1rem;
}

@theme inline {
  --font-sans: "Archivo Variable", "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Instrument Serif", Georgia, serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --color-lamp: #ffc46b;
  --color-lamp-ink: #1d1505;
  --color-lamp-text: #ffd08a;
  --color-live: #6ee7a8;
  --color-live-text: #b9f5d4;
}

@utility glass {
  background: var(--card);
  border: 1px solid var(--border);
  backdrop-filter: blur(24px) saturate(150%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 24px 60px rgba(3, 5, 12, 0.35);
}

@utility lamp {
  background: var(--color-lamp);
  color: var(--color-lamp-ink);
  box-shadow:
    0 0 0 1px rgba(255, 214, 150, 0.6),
    0 8px 30px rgba(255, 180, 80, 0.45);
}

@media (prefers-reduced-transparency: reduce) {
  .glass {
    background: #161a2a;
    backdrop-filter: none;
  }
}
```

Then add `glass` and `lamp` variants to the `Button` cva in `packages/ui/src/components/button.tsx`, plus a `pill` size (44px tall, `rounded-full`) and a `mic` size (64px round).

## 5. Views

| Id        | Label   | Mood                                                          | File                                    |
| --------- | ------- | ------------------------------------------------------------- | --------------------------------------- |
| `harbour` | Harbour | City at dusk: skyline, an arch bridge, lit windows on water   | [`harbour.svg`](loft/views/harbour.svg) |
| `coast`   | Coast   | Golden afternoon: sandstone cliff, sea, a lighthouse, a beach | [`coast.svg`](loft/views/coast.svg)     |
| `alps`    | Alps    | Blue hour: snowy peaks, pines, a lit chalet, the moon         | [`alps.svg`](loft/views/alps.svg)       |

In the canvas source the Harbour view's id is `city`. Use `harbour` in code.

**Layers, back to front:**

1. **Scene SVG.** It's 1440×900 and fills the screen, cropped like `preserveAspectRatio="xMidYMax slice"`: centred horizontally, bottom-anchored, so the horizon and foreground stay in frame at any size. As an `<img>`, that's `object-fit: cover; object-position: center bottom`. The files are self-contained, with no scripts or external references.
2. **Vignette.** `radial-gradient(130% 100% at 50% 35%, transparent 55%, rgba(5,7,15,0.5) 100%)`.
3. **Window frame (desktop only).** All colour `#0b0e18`: a 14px top beam, a 6px transom at 22% height (85% opacity), and 10px mullions centred at 33.333% and 66.666% (90% opacity). Add [`window-plant.svg`](loft/views/window-plant.svg) at 300×340, `left: -30px; bottom: -20px`. The frame is what makes it feel like you're inside a room. Leave it off on phones, where it crowds a narrow screen.
4. **Screen dim**, if the screen asks for one (§4.2).
5. **Content.**

All of these layers are decorative: `aria-hidden="true"` and `pointer-events: none`.

**Behaviour:**

- Each user picks a view, saved in Convex so it follows them across devices. Default to Harbour for new users (§14).
- The switcher is a segmented control in the header (desktop) and in the profile menu (phone). Switching cross-fades the views.
- The header shows the view's name and the local time, in mono (`7:12 pm`).
- Picking a view by time of day (Coast in the morning, Harbour at night) is a nice later idea, not part of v1.

**Adding a view later:** one SVG in the same 1440×900 frame, with the horizon around y 560–700 and the foreground at the bottom. Check that `text-muted` on glass still passes 4.5:1 over its brightest area.

## 6. The shell

```
┌ view layer (fixed, full bleed) ──────────────────────────────┐
│ ┌ header ─────────────────────────────────────────────────┐ │
│ │ [⌂ The Loft] [R2 R2C2 ▾]      [● 1 job] [Coast 7:40 am DS] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                     screen content                           │
│                 [ core input, always present ]               │
└──────────────────────────────────────────────────────────────┘
```

- **Header left:** the wordmark pill (links home), then the site switcher pill (the site badge, its name and a chevron).
- **Header right:** the background-jobs pill (only while a job is running or has just finished, with the breathing lamp dot and "1 job in the background"), then the view and time pill with the avatar.
- **Phone header:** a 44px home button with the Loft mark, the jobs pill, and the site badge with a chevron.
- **No permanent sidebar.** Pages, enquiries and history are reached by asking, from result cards, or from the site switcher's menu. The existing screens remain reachable there (§12).

## 7. Components

Each line gives the component, what it holds, and its states. Exact styling is in the reference files.

- **CoreInput.** It has a label ("What are we working on today?"), a site scope chip (badge, name, chevron) at the top right, and the text input with "Say it the way you'd say it to a person…" as its placeholder. Then Attach (Paperclip, or Camera on a phone) and the lamp mic, with up to three suggestion chips under a divider. On desktop Home it sits centred. Its docked variant is a single 999px-radius pill at the bottom of a conversation, with the placeholder "Keep talking, or type…" and the chips left out. On a phone it sits at the bottom of every screen.
  - **States:** idle, typing (Enter sends), listening (the mic opens Voice), sending (the input clears and the message appears in the thread).
- **SuggestionChips.** These are worked out from what's going on, and three at most. With new enquiries, show "Read me the 2 enquiries". With a draft waiting, "Publish the /how draft". With changes since your last visit, "What changed overnight?". Otherwise, "Start a new site". Tapping a chip sends it as if you'd said it.
- **ActivityList ("Lately").** Each row has a 30px round icon chip, a title, a detail line, and the time on the right. There are three kinds:
  - **live:** `Globe` on `live-tint`, e.g. "Published /pricing · New page · three plans".
  - **enquiry:** `Inbox` on lamp, e.g. "2 new enquiries · From the /contact form".
  - **draft:** `File` on `fill-3`, e.g. "Japanese How it works · Draft · /ja/how".
  - **Copy rules:** past tense, the outcome first, no actor for your own actions, and never a tool name.
- **SiteRow.** The site badge, the name, the address in mono, and a live dot with "Live" (or "Coming soon").
- **Message.**
  - **Yours:** glass, aligned right, with a small `lamp-text` Mic icon before the text if it was spoken.
  - **Concierge:** glass, aligned left, with a header row showing a 26px lamp circle with `ConciergeBell` and "Concierge". The body is plain prose.
- **WhatIDid.** A collapsible `details` element inside a Concierge message, with a list of plain steps, each with a `live` check. Example: "Found the footer on all 4 pages", "Tidied it on /, /how, /contact and /pricing", "Checked the draft against the house rules".
- **ResultCard.** It has a 150×84 page thumbnail (a scaled live preview of the draft), a title ("New footer on 4 pages"), and a status line ("Draft · house rules pass"). Then Preview (`fill-3`) and Publish (lamp). If the house rules fail, the AI fixes the draft before showing the card. If it can't, the card says what's wrong in plain words and offers "Open the HTML".
- **Thinking.** A lamp circle, a plain label ("Reading the enquiries") and the three thinking dots. Never show a tool name.
- **BackgroundPanel.** A glass panel titled "In the background" with a breathing dot. Each job has a name, a time estimate or "queued", a 6px progress bar (`fill-2` track, lamp fill), and a mono detail line ("/how → /ja/how"). When a job finishes, it posts a message in its conversation and briefly flashes the header pill.
- **WaitingCard.** A glass panel titled "Waiting for you" with a summary ("1 draft across 4 pages. Drafts save as you go.") and Preview plus Publish. This is where the floating Preview and Publish actions live now.
- **VoiceOrb.** A lamp circle (180px desktop, 140px phone) holding 7–9 bars in `lamp-ink` with the wave animation, over a halo. Tapping it finishes. Below it: "Tap to finish · swipe down to cancel" (phone) or "Esc to cancel" (desktop).
- **PlanCard.** Shown after a multi-step spoken or typed request, before acting. It has "Here's what I'll do" (or "I'll do this" on a phone), a time and scope note ("Drafts only · about a minute"), and numbered steps with mono numbers (`01`) and the path on the right. An optional lamp-tint note asks for missing facts ("I'll need prices for the three plans. I'll leave [PRICE] until you tell me."). Then Go ahead (lamp) and Change the plan (`fill-3`).
- **PublishSheet (phone).** A bottom sheet with the site badge and "1 draft ready", a serif title ("Your pricing page is ready to go live."), a thumbnail row with the path, a summary and "House rules pass". The note reads "It goes live at r2c2.lofty.page within a minute, and you can roll it back." The buttons are Publish (lamp, 52px), Look first and Not now.

## 8. Screens

The reference file for each is in [`loft/reference/`](loft/reference/).

### A · Home (`Home.dc.html`, Coast)

Where you land, and the most important screen.

- **Greeting:** "Morning, Daniel." in serif 84. Use Morning before 12, Afternoon before 17, otherwise Evening.
- **Summary line:** one sentence built from what happened since your last visit, e.g. "/pricing went live last night, and two new enquiries came in. Nothing needs you yet." Say "Nothing needs you yet" only when no draft is waiting and no job needs an answer.
- **CoreInput**, centred, with live suggestion chips.
- **Below it, two columns that wrap on narrow screens:** on the left, "Lately" (ActivityList, about 4 rows, with an "All activity" link); on the right, "Sites" (SiteRows, plus a "New site" row).
- **Hide for now:** the "Connected" panel in the reference file. It belongs to MCP (§11).

### B · Conversation (`Thread.dc.html`, Harbour)

What Home becomes once you send something.

- The thread is centred (max 760px), with your messages on the right and the Concierge's on the left. Its replies carry WhatIDid and a ResultCard.
- A 300px side panel on the right holds the BackgroundPanel and the WaitingCard. Below about 900px wide, it moves under the thread.
- The docked CoreInput sits at the bottom.
- Long work is announced in plain words, e.g. "The translation takes a few minutes, so I've moved it to the background. Carry on and I'll tell you when it's ready."

### D · Phone home (`PhoneHome.dc.html`, Coast)

- **Header:** the wordmark pill and the avatar.
- **Greeting:** the date in mono, then "Morning, Daniel." in serif 52 and a short line ("Nothing needs you yet. Here's what happened overnight.").
- **"While you were away":** a glass list of 3 rows with the same kinds as ActivityList, with times like `11:48p`.
- **Bottom:** suggestion chips that scroll sideways, and the CoreInput card with the 64px mic.

### E · Phone conversation (`PhoneThread.dc.html`, Coast)

Messages stack from the bottom. The Concierge's reply includes a compact ResultCard (a 92×64 thumbnail, the page name, "Draft · 2 changes", then Preview and Publish at full width). A background job shows as a short message with a breathing dot ("Still translating How it works. I'll ping you when it's ready."). The docked input sits at the bottom.

### F · Phone voice (`PhoneVoice.dc.html`, Alps)

The view dims to 0.5. "Listening" sits at the top left in `lamp-text` caps, with Close at the top right. The transcript is in serif 34, with the not-yet-recognised tail in `text-unheard`. A compact PlanCard follows, with the VoiceOrb at the bottom where your thumb is.

### G · Phone publish (`PhoneApprove.dc.html`, Harbour)

The PublishSheet over a dimmed screen. It opens from a Publish button or from a "ready to publish" notification. "Look first" opens the full-screen preview.

### Desktop voice

There's no new desktop voice screen yet. Reuse the phone's layout centred over the view, using the first-pass "Listening" screen on the canvas's "First pass" page for scale (orb 180px, transcript serif 44, PlanCard max 620px).

## 9. Behaviour

**The AI**

- It creates pages and changes existing ones, always as drafts, using the site's theme and house rules as context (SPEC §11–12).
- It runs the publish checks (`packages/html`) on every draft it makes and fixes failures before showing a result. Readable errors from the pipeline are fed back to the model, within a retry budget.
- It asks when a fact is missing and leaves a visible placeholder (`[PRICE]`) rather than inventing one.
- Multi-step requests get a PlanCard first. Single, clear requests ("make the headline warmer") just happen.
- Anything that will take more than about 10 seconds becomes a background job.
- It never publishes. Publish buttons call the existing publish action, which keeps its confirmation, versioning and rollback.

**Voice**

- On desktop, hold Space (when no text field has focus) or press the mic. On a phone, tap the mic.
- The transcript appears live, and finishing sends it as a message marked as spoken.
- Esc, or swiping down on a phone, cancels without sending.

**Activity**

The "Lately" list reads from data that already exists:

| Source                                           | Row                                                    |
| ------------------------------------------------ | ------------------------------------------------------ |
| `auditLog` `page.publish`                        | live · "Published {path}"                              |
| `auditLog` `page.rollback`                       | live · "Rolled back {path}"                            |
| `auditLog` `page.create`                         | draft · "Created {path}"                               |
| `auditLog` `page.restore`                        | draft · "Restored an earlier draft of {path}"          |
| `enquiries` with status `new`, grouped per visit | enquiry · "{n} new enquiries" · "From the {form} form" |
| AI drafts (new)                                  | draft · "Drafted {what}" · "Draft · {path}"            |

Site, domain and member events stay out of "Lately" for now. Your own actions show no actor. If teammates are added later, prefix their first name ("Sam published /pricing"). Anything done through MCP later counts as the signed-in user.

**Notifications (phone, later):** "Your pricing page is ready to go live" when a draft from a background job is ready, and "2 new enquiries". Tapping a notification opens the matching screen.

## 10. Accessibility

- Use real elements: `button`, `a href`, `input` with a `label` (visually hidden where the design shows none), and `details`/`summary` for WhatIDid.
- `aria-label` on every icon-only button ("Talk to Concierge", "Add an image or file", "Send").
- The focus ring is 2px `lamp`, offset 2px, on everything.
- Streaming replies and "job finished" messages go in an `aria-live="polite"` region. The voice transcript is `aria-live` while listening.
- Views and dims are decorative (`aria-hidden`).
- Reduced motion and reduced transparency are handled as in §4.2 and §4.6.
- Never use colour alone for meaning: live, enquiry and draft rows each have their own icon.

## 11. Later: MCP and the Connect screen

Kept for later, out of scope for v1: `Connect.dc.html` ("Open your loft to any assistant": the MCP address, three setup steps, connected assistants, and a permission level per tool). When it's built:

- It's reached from the profile menu, not from Home.
- Assistants act as the signed-in user, and their work appears in "Lately" like anything else (§9).
- The tool list matches `add-mcp-server` and SPEC §11.

Build the AI's tools in v1 as plain backend functions with zod inputs, so the MCP server can reuse them later without a rewrite.

## 12. Fitting it into the codebase (_suggested_)

- **`packages/ui`:** the tokens and utilities from §4.7, fonts, `glass` and `lamp` button variants, and glass versions of Input and Card.
- **`apps/loft/src/components/loft/`:** `LoftView`, `Shell`, `CoreInput`, `ActivityList`, `Message`, `ResultCard`, `BackgroundPanel`, `PlanCard`, `VoiceOrb` and `PublishSheet`.
- **Routes:** Home becomes `_authed/index.tsx`. Conversations get their own route (for example `_authed/talk/$threadId.tsx`) so they can be linked and resumed. The existing site, page, editor, history and enquiry routes stay, inside the new shell, and are reached from the site switcher, result cards and "Open the HTML".
- **Previews:** thumbnails and Preview reuse `PreviewFrame` and `usePreview` from `components/page-preview.tsx`.
- **Backend:** a per-user preferences table (`view`, `lastSeenAt` for "since your last visit"), conversation threads and messages, and a jobs table with progress. All of them are read through live queries, so the jobs pill and "Lately" update by themselves.

## 13. Reading the reference files

The `.dc.html` files are Claude Design source, not production code. Read them for exact values, not structure:

- **Values are exact.** Inline `style="…"` attributes are the real sizes, colours and spacing. Shared materials (`.glass`, `.lamp`) are defined in each file's `<helmet><style>`.
- **Markup is a template.** `{{name}}` is a value from `renderVals()` in the script at the bottom of the file, `<sc-for list>` repeats, and `<sc-if value>` branches.
- **Sample data lives in the script.** Activity rows, tool steps and the voice bars are in `renderVals()`.
- **Scenes are imported.** `<dc-import name="Scene" view="coast">` places the view (`Scene.dc.html`). The standalone SVGs in `loft/views/` are the same art.
- **Build accessible, responsive React** with the shared components, not a copy of the markup. All copy in the files is final unless it's in `[BRACKETS]`.

## 14. Open questions

- Is "Concierge" the AI's name?
- Which view do new users get? This spec assumes Harbour.
- Which speech-to-text service? It needs an ADR before the voice task.
- Do suggestion chips need to work offline or without AI, as fixed shortcuts?
