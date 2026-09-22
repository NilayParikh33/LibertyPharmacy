/**
 * Animated hero illustration: a pulsing pharmacy cross, a prescription bottle
 * and floating capsules over a travelling heartbeat line.
 *
 * Inline SVG + CSS keyframes (globals.css, "Illustration motion") — no image
 * files, so it adds no requests and stays inside the CSP (img-src 'self').
 * Purely decorative: hidden from assistive tech, and it renders as a still
 * picture under prefers-reduced-motion.
 *
 * Every animated part sits in its own <g>: the outer group positions it with
 * an SVG transform attribute, the inner group carries the CSS animation, so
 * the two transforms never overwrite each other.
 */

/** Two-tone capsule centred on the origin (56 x 22). */
function Capsule({ colour }: { colour: string }) {
  return (
    <>
      <path d="M0,-11 H-17 A11,11 0 0 0 -17,11 H0 Z" fill={colour} />
      <path d="M0,-11 H17 A11,11 0 0 1 17,11 H0 Z" fill="#f8fafc" />
      <path d="M-22,-4.5 H-9" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/** Four-point sparkle centred on the origin. */
function Sparkle() {
  return <path d="M0,-9 L2.2,-2.2 L9,0 L2.2,2.2 L0,9 L-2.2,2.2 L-9,0 L-2.2,-2.2 Z" fill="#fff" />;
}

export default function PharmacyHeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 320"
      aria-hidden="true"
      focusable="false"
      className={`lp-art ${className}`}
    >
      {/* Soft halo behind everything. */}
      <circle cx="200" cy="140" r="132" fill="#fff" fillOpacity="0.05" />

      {/* Sparkles. */}
      <g transform="translate(150 34)"><g className="lp-twinkle"><Sparkle /></g></g>
      <g transform="translate(258 26) scale(0.8)"><g className="lp-twinkle-b"><Sparkle /></g></g>
      <g transform="translate(374 112) scale(0.9)"><g className="lp-twinkle-c"><Sparkle /></g></g>
      <g transform="translate(26 64) scale(0.8)"><g className="lp-twinkle-c"><Sparkle /></g></g>
      <g transform="translate(372 262) scale(0.7)"><g className="lp-twinkle"><Sparkle /></g></g>

      {/* Pulse rings expanding from the cross. */}
      <circle cx="200" cy="140" r="68" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" className="lp-ring" />
      <circle cx="200" cy="140" r="68" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" className="lp-ring-b" />

      {/* Pharmacy cross badge. */}
      <g className="lp-beat">
        <circle cx="200" cy="140" r="68" fill="#fff" />
        <circle cx="200" cy="140" r="58" fill="none" stroke="#dce5f3" strokeWidth="2" />
        <rect x="186" y="102" width="28" height="76" rx="7" fill="#c0392b" />
        <rect x="162" y="126" width="76" height="28" rx="7" fill="#c0392b" />
      </g>

      {/* Prescription bottle. */}
      <g transform="translate(78 212)">
        <g className="lp-float-b">
          <rect x="-30" y="-46" width="60" height="18" rx="4" fill="#f1f5f9" />
          <rect x="-27" y="-28" width="54" height="74" rx="8" fill="#e39b2f" />
          <rect x="-27" y="-8" width="54" height="38" fill="#fff" />
          <rect x="-21" y="-24" width="5" height="62" rx="2.5" fill="#fff" fillOpacity="0.28" />
          <rect x="-4" y="-2" width="8" height="24" rx="2" fill="#c0392b" />
          <rect x="-12" y="6" width="24" height="8" rx="2" fill="#c0392b" />
          <rect x="-20" y="24" width="40" height="3" rx="1.5" fill="#cbd5e1" />
        </g>
      </g>

      {/* Capsules. */}
      <g transform="translate(96 66) rotate(20)"><g className="lp-float"><Capsule colour="#c0392b" /></g></g>
      <g transform="translate(322 72) rotate(-28)"><g className="lp-float-c"><Capsule colour="#638bc4" /></g></g>
      <g transform="translate(324 214) rotate(38)"><g className="lp-float-b"><Capsule colour="#d4a848" /></g></g>

      {/* Round tablets. */}
      <g transform="translate(352 152)">
        <g className="lp-float-c">
          <circle r="12" fill="#f8fafc" />
          <path d="M-8,0 H8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(48 132)">
        <g className="lp-float">
          <circle r="9" fill="#f8fafc" />
          <path d="M-6,0 H6" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      {/* Heartbeat: faint full line, with a bright segment travelling along it. */}
      <path
        d="M16 294 H128 L146 268 L166 322 L186 280 L200 294 H384"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 294 H128 L146 268 L166 322 L186 280 L200 294 H384"
        pathLength={1}
        fill="none"
        stroke="#d4a848"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lp-pulse-line"
      />
    </svg>
  );
}
