export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  // Inline SVG mark: woven flag of tapered brush strokes — pale blue weft over deep blue warp.
  const weft = "M6 26 C 26 17, 52 19, 90 8 C 54 27, 28 29, 6 26 Z";
  const warp = "M51 6 C 43 32, 55 60, 40 94 C 48 60, 37 32, 46 6 Z";

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="#9db9dd">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={weft} transform={`translate(${i % 2 ? 2 : 0} ${i * 12 + 8})`} />
        ))}
      </g>
      <g fill="#2a5da9">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={warp} transform={`translate(${i * 7 - 17} ${i % 2 ? 1 : 0})`} />
        ))}
      </g>
    </svg>
  );
}
