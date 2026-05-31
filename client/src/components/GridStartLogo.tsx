export function GridStartLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="GridStart logo">
      {/* Checkered flag pattern - 4x4 grid, alternating */}
      <rect x="2" y="2" width="6" height="6" fill="currentColor" />
      <rect x="14" y="2" width="6" height="6" fill="currentColor" />
      <rect x="8" y="8" width="6" height="6" fill="currentColor" />
      <rect x="20" y="8" width="6" height="6" fill="currentColor" />
      <rect x="2" y="14" width="6" height="6" fill="currentColor" />
      <rect x="14" y="14" width="6" height="6" fill="currentColor" />
      <rect x="8" y="20" width="6" height="6" fill="currentColor" />
      <rect x="20" y="20" width="6" height="6" fill="currentColor" />
      {/* Red accent corner */}
      <rect x="26" y="2" width="4" height="4" rx="1" fill="hsl(0 89% 50%)" />
    </svg>
  );
}
