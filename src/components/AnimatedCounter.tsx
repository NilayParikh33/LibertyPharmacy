"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect has no server equivalent and React warns if it is called
// during SSR. We only ever need the layout timing in the browser.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Count-up statistic, e.g. "50K+".
 *
 * Counts from 0 up to `value` the first time it scrolls into view, then holds
 * the final number.
 *
 * WHY THE STATE STARTS AT `value`, NOT 0:
 * the server must render the real number so the page is correct with
 * JavaScript disabled (otherwise the stat reads a permanent "0"). The client's
 * first render matches it, so hydration is clean, and a layout effect resets
 * the display to 0 *before the browser paints* — so there is no flash of the
 * final value ahead of the animation.
 *
 * Under prefers-reduced-motion, or with no IntersectionObserver, the value is
 * simply left as-is and never animates.
 */
export default function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  durationMs = 1600,
  className = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [display, setDisplay] = useState(value);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Nothing to animate — leave the final value on screen.
    if (!el || reduced || typeof IntersectionObserver === "undefined") return;

    // Runs before paint, so the final value is never shown first.
    setDisplay(0);

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / durationMs, 1);
          // easeOutExpo — fast start, gentle settle.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(Math.round(eased * value));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      // If this unmounts mid-count, leave the true value behind.
      setDisplay(value);
    };
  }, [value, durationMs]);

  return (
    <p ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-US")}
      {suffix}
    </p>
  );
}
