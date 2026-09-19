"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper.
 *
 * Children start hidden (`.lp-reveal` sets opacity:0) and animate in the first
 * time the element enters the viewport. Revealing is one-way — we unobserve
 * immediately so scrolling back up never replays the animation.
 *
 * FAILSAFES (content must never stay invisible):
 *  - No IntersectionObserver support → reveal on mount.
 *  - prefers-reduced-motion → CSS forces the visible state (globals.css).
 *  - JavaScript disabled → <noscript> override in layout.tsx.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  variant = "up",
  className = "",
  threshold = 0.15,
}: {
  children: ReactNode;
  /** Element to render. Use "li"/"section" etc. to keep markup semantic. */
  as?: ElementType;
  /** Stagger offset in ms — pass index * 80 for a grid. */
  delay?: number;
  variant?: "up" | "fade" | "scale";
  className?: string;
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // Older browsers (and any environment without IO) get the content straight away.
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    // Already on screen at mount (e.g. a short page) — reveal without waiting
    // for a scroll event that may never come.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const variantClass =
    variant === "fade" ? "lp-reveal-fade" : variant === "scale" ? "lp-reveal-scale" : "";

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${variantClass} ${className}`.trim()}
      data-revealed={revealed ? "true" : "false"}
      style={delay ? ({ "--lp-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
