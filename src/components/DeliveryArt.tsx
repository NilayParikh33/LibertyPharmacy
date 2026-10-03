/**
 * Animated delivery scene: a Liberty van drives past the pharmacy and a row of
 * homes while clouds drift slowly overhead. Deliberately calm — one moving
 * subject, no speed lines or bounce.
 *
 * Inline SVG + CSS keyframes (globals.css, "Illustration motion"). Decorative
 * only — hidden from assistive tech, and still under prefers-reduced-motion.
 */

const NAVY = "#284577";
const NAVY_DARK = "#1b2a47";
const RED = "#c0392b";
const GOLD = "#d4a848";

function Cloud() {
  return (
    <>
      <ellipse cx="0" cy="0" rx="26" ry="9" fill="#fff" />
      <ellipse cx="-12" cy="-6" rx="13" ry="9" fill="#fff" />
      <ellipse cx="8" cy="-9" rx="15" ry="11" fill="#fff" />
    </>
  );
}

function House({ x, w, h, roof }: { x: number; w: number; h: number; roof: string }) {
  const base = 176;
  return (
    <g>
      <rect x={x} y={base - h} width={w} height={h} rx="3" fill="#fff" />
      <path d={`M${x - 6},${base - h + 2} L${x + w / 2},${base - h - 28} L${x + w + 6},${base - h + 2} Z`} fill={roof} />
      <rect x={x + w / 2 - 9} y={base - 34} width="18" height="34" rx="2" fill={NAVY} />
      <rect x={x + 10} y={base - h + 16} width="16" height="16" rx="2" fill={GOLD} fillOpacity="0.85" />
      <rect x={x + w - 26} y={base - h + 16} width="16" height="16" rx="2" fill={GOLD} fillOpacity="0.85" />
    </g>
  );
}

export default function DeliveryArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 220"
      aria-hidden="true"
      focusable="false"
      className={`lp-art ${className}`}
    >
      {/* Sky. */}
      <rect width="600" height="220" rx="20" fill="#e6eefa" />
      <circle cx="262" cy="40" r="20" fill={GOLD} fillOpacity="0.85" />

      {/* Clouds drift back and forth. */}
      <g transform="translate(120 46)"><g className="lp-drift"><Cloud /></g></g>
      <g transform="translate(360 30) scale(0.75)"><g className="lp-drift-b"><Cloud /></g></g>

      {/* Ground behind the buildings. */}
      <rect x="0" y="168" width="600" height="10" fill="#c0d0e8" />

      {/* Pharmacy: taller building with a sign. */}
      <g>
        <rect x="26" y="66" width="118" height="110" rx="4" fill="#fff" />
        <rect x="26" y="66" width="118" height="22" rx="4" fill={NAVY} />
        <circle cx="52" cy="77" r="7" fill="#fff" />
        <rect x="50.5" y="71.5" width="3" height="11" rx="1" fill={RED} />
        <rect x="46.5" y="75.5" width="11" height="3" rx="1" fill={RED} />
        <text x="72" y="82" fontSize="11" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
          PHARMACY
        </text>
        <rect x="40" y="100" width="34" height="34" rx="3" fill="#dce5f3" />
        <rect x="88" y="100" width="42" height="76" rx="3" fill={NAVY} />
        <rect x="40" y="144" width="34" height="32" rx="3" fill="#dce5f3" />
      </g>

      {/* Homes. */}
      <House x={214} w={84} h={72} roof={NAVY_DARK} />
      <House x={340} w={92} h={80} roof={RED} />
      <House x={474} w={84} h={70} roof={NAVY} />

      {/* A heart over the last home — static; the van carries the motion. */}
      <g transform="translate(516 54)">
        <g>
          <path
            d="M0,10 C-16,-2 -12,-16 0,-8 C12,-16 16,-2 0,10 Z"
            fill={RED}
          />
        </g>
      </g>

      {/* Trees. */}
      <g>
        <rect x="180" y="150" width="5" height="26" fill="#6b7f5e" />
        <circle cx="182.5" cy="144" r="15" fill="#5f8f6b" />
        <rect x="310" y="152" width="5" height="24" fill="#6b7f5e" />
        <circle cx="312.5" cy="146" r="13" fill="#6fa07a" />
        <rect x="448" y="152" width="5" height="24" fill="#6b7f5e" />
        <circle cx="450.5" cy="146" r="13" fill="#5f8f6b" />
      </g>

      {/* Road with a static centre line — the van moves, the scene does not. */}
      <rect x="0" y="176" width="600" height="44" fill={NAVY_DARK} />
      <rect x="0" y="176" width="600" height="3" fill="#3a5482" />
      <line
        x1="0"
        y1="200"
        x2="640"
        y2="200"
        stroke="#dce5f3"
        strokeOpacity="0.85"
        strokeWidth="3"
        strokeDasharray="24 20"
      />

      {/* Delivery van, driving left to right. */}
      <g transform="translate(0 192)">
        <g className="lp-drive">
          <g>
            {/* Cargo box and cab. */}
            <rect x="0" y="-56" width="78" height="46" rx="6" fill={RED} />
            <path d="M78,-56 H100 L122,-32 V-10 H78 Z" fill="#a93226" />
            <path d="M84,-50 H97 L113,-32 H84 Z" fill="#cfe0f5" />
            <rect x="0" y="-24" width="122" height="6" fill="#fff" fillOpacity="0.9" />
            <rect x="118" y="-28" width="5" height="7" rx="2" fill={GOLD} />

            {/* Cross on the cargo box. */}
            <rect x="36" y="-49" width="6" height="19" rx="1.5" fill="#fff" />
            <rect x="29.5" y="-42.5" width="19" height="6" rx="1.5" fill="#fff" />

            {/* Wheels. */}
            <g transform="translate(26 -8)">
              <circle r="11" fill={NAVY_DARK} />
              <g className="lp-wheel">
                <circle r="6" fill="#cbd5e1" />
                <path d="M-6,0 H6 M0,-6 V6" stroke={NAVY_DARK} strokeWidth="2" />
              </g>
            </g>
            <g transform="translate(96 -8)">
              <circle r="11" fill={NAVY_DARK} />
              <g className="lp-wheel">
                <circle r="6" fill="#cbd5e1" />
                <path d="M-6,0 H6 M0,-6 V6" stroke={NAVY_DARK} strokeWidth="2" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
