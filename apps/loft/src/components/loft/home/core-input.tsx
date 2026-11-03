import { Mic, Paperclip } from "lucide-react"
import type { ReactNode } from "react"

/** The talk-or-type input on Home. It's shown once the conversation ships (`CONVERSATION_ENABLED`). */
export function CoreInput({ children }: { children?: ReactNode }) {
  return (
    <form
      className="flex flex-col gap-3.5 rounded-[32px] py-4.5 pr-4.5 pl-5.5 glass"
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor="today" className="text-[13px] text-muted-foreground">
        What are we working on today?
      </label>
      <div className="flex items-center gap-3">
        <input
          id="today"
          type="text"
          placeholder="Say it the way you'd say it to a person…"
          className="h-13 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-placeholder sm:text-2xl"
        />
        <button
          type="button"
          aria-label="Add an image or file"
          className="grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground"
        >
          <Paperclip
            aria-hidden="true"
            className="size-5.5"
            strokeWidth={1.8}
          />
        </button>
        <button
          type="button"
          aria-label="Talk to Concierge"
          className="grid size-16 shrink-0 place-items-center rounded-full lamp sm:size-17"
        >
          <Mic aria-hidden="true" className="size-7" strokeWidth={1.9} />
        </button>
      </div>
      {children && (
        <div className="border-t border-fill-2 pt-2.5">{children}</div>
      )}
    </form>
  )
}
