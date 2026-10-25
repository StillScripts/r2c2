import type { EnquiryResponse, EnquirySource } from "@workspace/core"

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

const MESSAGES = {
  sending: "Sending…",
  sent: "Thanks, your message has been sent.",
  invalid: "Please fix the highlighted fields.",
  error: "Sorry, something went wrong. Please try again.",
}

type State = "idle" | "sending" | "sent" | "error"
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

type Turnstile = {
  render(container: HTMLElement, options: { sitekey: string }): string
  reset(widgetId?: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let turnstileScript: Promise<void> | undefined

function loadTurnstile() {
  turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = TURNSTILE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile failed to load"))
    document.head.append(script)
  })
  return turnstileScript
}

const source = (): EnquirySource => ({
  page: location.pathname,
  referrer: document.referrer,
  utm: Object.fromEntries(
    [...new URLSearchParams(location.search)].filter(([key]) =>
      key.startsWith("utm_")
    )
  ),
})

const isField = (element: unknown): element is Field =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement

export class SiteForm extends HTMLElement {
  #form?: HTMLFormElement
  #status = document.createElement("p")
  #fieldErrors: { field: Field; message: HTMLElement }[] = []
  #widgetId?: string

  connectedCallback() {
    const form = this.querySelector("form")
    if (!form || this.#form) return
    this.#form = form
    this.#status.setAttribute("role", "status")
    form.append(this.#status)
    form.addEventListener("submit", (event) => {
      event.preventDefault()
      void this.#submit(form)
    })
    void this.#renderTurnstile(form)
    this.#setState(
      new URLSearchParams(location.search).has("sent") ? "sent" : "idle"
    )
  }

  get #submitButton() {
    return this.#form?.querySelector<HTMLButtonElement | HTMLInputElement>(
      "button:not([type]), button[type=submit], input[type=submit]"
    )
  }

  async #renderTurnstile(form: HTMLFormElement) {
    const sitekey = this.getAttribute("sitekey")
    if (!sitekey) return
    const container = document.createElement("div")
    const button = this.#submitButton
    if (button) button.before(container)
    else form.append(container)
    try {
      await loadTurnstile()
      this.#widgetId = window.turnstile?.render(container, { sitekey })
    } catch {
      // The server rejects the missing token, which shows the general error.
    }
  }

  #setState(state: State, message = state === "idle" ? "" : MESSAGES[state]) {
    this.dataset.state = state
    this.#status.textContent = message
    this.#status.hidden = !message
    this.#submitButton?.toggleAttribute("disabled", state === "sending")
  }

  #showFieldErrors(form: HTMLFormElement, errors: Record<string, string[]>) {
    const entries = Object.entries(errors)
    for (const [name, [text = MESSAGES.invalid] = []] of entries) {
      const field = form.elements.namedItem(name)
      if (!isField(field)) return false
      const message = document.createElement("p")
      message.id = `${this.getAttribute("name")}-${name}-error`
      message.textContent = text
      field.after(message)
      field.setAttribute("aria-invalid", "true")
      field.setAttribute("aria-describedby", message.id)
      this.#fieldErrors.push({ field, message })
    }
    this.#fieldErrors[0]?.field.focus()
    return entries.length > 0
  }

  #clearFieldErrors() {
    for (const { field, message } of this.#fieldErrors) {
      message.remove()
      field.removeAttribute("aria-invalid")
      field.removeAttribute("aria-describedby")
    }
    this.#fieldErrors = []
  }

  async #submit(form: HTMLFormElement) {
    this.#clearFieldErrors()
    this.#setState("sending")
    const fields = Object.fromEntries(
      [...new FormData(form)].filter(([, value]) => typeof value === "string")
    )
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...fields, _source: source() }),
      })
      if (response.status === 201) {
        form.reset()
        this.#setState("sent")
        return
      }
      if (response.status === 400) {
        const result = (await response.json()) as EnquiryResponse
        if (!result.ok && this.#showFieldErrors(form, result.errors)) {
          this.#setState("error", MESSAGES.invalid)
          window.turnstile?.reset(this.#widgetId)
          return
        }
        this.#clearFieldErrors()
      }
    } catch {
      // Network failures fall through to the general error.
    }
    this.#setState("error")
    window.turnstile?.reset(this.#widgetId)
  }
}
