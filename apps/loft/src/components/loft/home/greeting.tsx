import { ClientOnly } from "@/components/client-only"
import { greetingFor } from "@/lib/home"

/** "Morning, Daniel." by the browser's clock, so it's rendered only once mounted. */
export function Greeting({ name }: { name: string }) {
  const first = name.split(/\s+/)[0]
  return (
    <h1 className="min-h-[0.95em] font-serif text-[52px] leading-[0.95] tracking-[-0.01em] text-on-view sm:text-[84px]">
      <ClientOnly>
        {greetingFor(new Date().getHours())}
        {first && `, ${first}`}.
      </ClientOnly>
    </h1>
  )
}
