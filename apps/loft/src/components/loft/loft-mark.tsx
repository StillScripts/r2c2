/** The Loft mark: a roof, walls and a four-pane window, stroked in lamp. */
export function LoftMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 12h4v4h-4zM12 12v4M10 14h4" />
    </svg>
  )
}
