import { useConvexMutation } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@workspace/ui/components/menu"
import type { FunctionReturnType } from "convex/server"
import {
  ChevronDown,
  File,
  Inbox,
  LayoutGrid,
  LogOut,
  Palette,
} from "lucide-react"
import { LocalTime } from "@/components/loft/local-time"
import { LoftMark } from "@/components/loft/loft-mark"
import { SiteBadge } from "@/components/loft/site-badge"
import { newEnquiriesQuery } from "@/lib/queries"
import { VIEWS, type View, viewIds } from "@/lib/views"

type Me = NonNullable<FunctionReturnType<typeof api.staff.me>>
type Site = Me["sites"][number]

const PILL = "glass flex h-11 items-center rounded-full"

/** The Loft's header: the wordmark, the site switcher inside a site, and the view pill. */
export function ShellHeader({
  me,
  onSignOut,
}: {
  me: Me
  onSignOut: () => void
}) {
  const { siteId } = useParams({ strict: false })
  const site = me.sites.find((site) => site.siteId === siteId)

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <Link
          to="/"
          aria-label="The Loft, home"
          className={`${PILL} w-11 shrink-0 justify-center gap-2.5 sm:w-auto sm:pr-4 sm:pl-3`}
        >
          <LoftMark className="size-6 text-lamp" />
          <span className="hidden font-serif text-2xl sm:inline">The Loft</span>
        </Link>
        {site && <SiteSwitcher site={site} sites={me.sites} />}
      </div>
      <ViewMenu me={me} onSignOut={onSignOut} />
    </header>
  )
}

function SiteSwitcher({ site, sites }: { site: Site; sites: Site[] }) {
  const { siteId } = site
  const { data: enquiries } = useQuery(newEnquiriesQuery(siteId))
  const others = sites.filter((other) => other.siteId !== siteId)

  return (
    <Menu>
      <MenuTrigger
        className={`${PILL} min-w-0 gap-2 pr-3 pl-2 text-sm font-semibold`}
      >
        <SiteBadge name={site.name} brand={site.brand} />
        <span className="hidden truncate sm:inline">{site.name}</span>
        <span className="sr-only sm:hidden">{site.name}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuGroup>
          <MenuLabel>{site.name}</MenuLabel>
          <MenuLinkItem
            render={<Link to="/sites/$siteId" params={{ siteId }} />}
          >
            <File aria-hidden="true" />
            Pages
          </MenuLinkItem>
          <MenuLinkItem
            render={
              <Link
                to="/sites/$siteId/enquiries"
                params={{ siteId }}
                search={{ status: "new" }}
              />
            }
          >
            <Inbox aria-hidden="true" />
            Enquiries
            {enquiries && enquiries.count > 0 && (
              <span className="ml-auto rounded-full bg-lamp-tint px-2 text-xs text-lamp-soft">
                {enquiries.count}
                {enquiries.capped && "+"} new
              </span>
            )}
          </MenuLinkItem>
          {site.role === "owner" && (
            <MenuLinkItem
              render={<Link to="/sites/$siteId/theme" params={{ siteId }} />}
            >
              <Palette aria-hidden="true" />
              Theme
            </MenuLinkItem>
          )}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          {others.length > 0 && <MenuLabel>Your other sites</MenuLabel>}
          {others.map((other) => (
            <MenuLinkItem
              key={other.siteId}
              render={
                <Link to="/sites/$siteId" params={{ siteId: other.siteId }} />
              }
            >
              <SiteBadge name={other.name} brand={other.brand} />
              {other.name}
            </MenuLinkItem>
          ))}
          <MenuLinkItem render={<Link to="/" />}>
            <LayoutGrid aria-hidden="true" />
            All sites
          </MenuLinkItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

/** The view, the time and your avatar. Opens the view switcher, your email and Sign out. */
function ViewMenu({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const setView = useConvexMutation(
    api.preferences.setView
  ).withOptimisticUpdate((store, { view }) => {
    const current = store.getQuery(api.staff.me, {})
    if (current) store.setQuery(api.staff.me, {}, { ...current, view })
  })

  return (
    <Menu>
      <MenuTrigger
        aria-label={`${VIEWS[me.view].label} view, ${me.name}`}
        className={`${PILL} shrink-0 gap-2.5 sm:pr-1.5 sm:pl-4`}
      >
        <span className="hidden text-sm sm:inline">{VIEWS[me.view].label}</span>
        <span className="hidden sm:inline">
          <LocalTime />
        </span>
        <span className="grid size-11 place-items-center rounded-full bg-[#e9d7c0] text-[13px] font-bold text-[#2a1d10] sm:size-8.5">
          {initials(me.name)}
        </span>
      </MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuLabel>View</MenuLabel>
          <MenuRadioGroup
            value={me.view}
            onValueChange={(view: View) => void setView({ view })}
          >
            {viewIds.map((id) => {
              const { label, icon: Icon } = VIEWS[id]
              return (
                <MenuRadioItem key={id} value={id} closeOnClick={false}>
                  <Icon aria-hidden="true" strokeWidth={1.8} />
                  {label}
                </MenuRadioItem>
              )
            })}
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <p className="truncate px-3 py-1 text-xs text-muted-foreground">
          {me.email}
        </p>
        <MenuItem onClick={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
