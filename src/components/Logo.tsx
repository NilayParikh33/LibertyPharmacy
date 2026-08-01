export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  // Inline SVG mark: torch in a shield — liberty + care. No external assets.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M24 3 6 10v12c0 11.5 7.7 20 18 23 10.3-3 18-11.5 18-23V10L24 3z"
        fill="#1b2a47"
      />
      <path
        d="M24 6.4 9 12.2v9.8c0 9.9 6.5 17.3 15 20.1 8.5-2.8 15-10.2 15-20.1v-9.8L24 6.4z"
        fill="#2f5592"
      />
      <path
        d="M24 12c1.8 2.7 2.7 4.7 2.7 6.2 0 2-1.2 3.3-2.7 3.3s-2.7-1.3-2.7-3.3c0-1.5.9-3.5 2.7-6.2z"
        fill="#d4a848"
      />
      <rect x="22.6" y="22.5" width="2.8" height="11" rx="1.2" fill="#fff" />
      <rect x="18" y="26" width="12" height="2.8" rx="1.2" fill="#fff" />
    </svg>
  );
}
