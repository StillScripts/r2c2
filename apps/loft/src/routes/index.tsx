import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-medium">Loft</h1>
        <p className="mt-2 text-muted-foreground">
          Where R2C2 sites are written and published.
        </p>
      </div>
    </main>
  )
}
