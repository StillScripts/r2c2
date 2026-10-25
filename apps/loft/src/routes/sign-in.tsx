import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useState, type FormEvent } from "react"
import { authClient } from "@/lib/auth-client"
import { safeRedirect } from "@/lib/redirect"

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search): { redirect?: string } =>
    search.redirect === undefined
      ? {}
      : { redirect: safeRedirect(search.redirect) },
  beforeLoad: ({ context, search }) => {
    if (context.token) throw redirect({ href: search.redirect ?? "/" })
  },
  head: () => ({ meta: [{ title: "Sign in · R2C2 Loft" }] }),
  component: SignIn,
})

function SignIn() {
  const router = useRouter()
  const search = Route.useSearch()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(undefined)
    const { error } = await authClient.signIn.email({
      email: form.get("email") as string,
      password: form.get("password") as string,
    })
    if (error) {
      setPending(false)
      setError(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Wrong email or password."
          : "Something went wrong. Please try again."
      )
      return
    }
    await router.navigate({ href: search.redirect ?? "/" })
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <form
        method="post"
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border p-6"
      >
        <div>
          <h1 className="text-2xl font-medium">Sign in to Loft</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the account an owner set up for you.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  )
}
