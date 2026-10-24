/** SmartStock mark: a shelf tag with a punched hole. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="var(--brand)" />
      <path d="M11 13.5a2.5 2.5 0 0 1 2.5-2.5h10.6l7.4 9-7.4 9H13.5a2.5 2.5 0 0 1-2.5-2.5z" fill="var(--tag)" />
      <circle cx="24.5" cy="20" r="2.2" fill="var(--brand)" />
      <path d="M15 17h5M15 20h5M15 23h3.5" stroke="var(--tag-ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
