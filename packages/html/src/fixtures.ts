export const THEME = `
@theme {
  --color-brand: #1f5b8a;
  --color-ink: #111111;
  --color-paper: #ffffff;
  --font-sans: Inter, sans-serif;
  --radius-card: 1rem;
}
@utility btn { padding: 0.5rem 1rem; background: var(--color-brand); }
@utility card { border-radius: var(--radius-card); }
@utility section { padding-block: 4rem; }
@utility prose { max-width: 65ch; }
`

const HEAD = `<title>Home</title><meta name="description" content="The home page">`

export const page = (body: string, head = HEAD) =>
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8">${head}</head><body>
${body}
</body></html>`

export const CLEAN_BODY = `<h1 class="text-ink">Welcome</h1>
<section class="section"><p class="prose">We build <a href="/about">websites for clinics</a>.</p>
<img src="/assets/1a2b3c.webp" alt="Our team at work" class="card"></section>
<site-form name="contact"><form method="post" action="/_api/forms/contact">
<label for="email">Email</label><input id="email" name="email" type="email" required maxlength="200">
<button type="submit" class="btn">Send</button></form></site-form>`
