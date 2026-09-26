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
  /**
   * HTML element to render, e.g. "li"/"section" to keep markup semantic.
   * Deliberately narrower than `ElementType`: this component always attaches
   * a DOM ref, and a function component passed here would need to forward
   * that ref itself or React drops it silently — breaking scroll-reveal for
   * that element. `HTMLElementTagNameMap` keys always accept a ref, so
   * restricting to them makes that failure mode impossible at the type
   * level instead of relying on callers to remember not to pass one.
   */
  as?: keyof HTMLElementTagNameMap;
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

  // The public `as` prop is narrowed to HTMLElementTagNameMap keys precisely
  // so a non-ref-forwarding component can never be passed in (see the prop's
  // doc comment). TypeScript's JSX typing still tries to resolve `ref`
  // against every tag's own element type when `Tag` is a literal union,
  // which balloons into an unrelated SVG/HTML ref mismatch. This cast only
  // widens what TSX uses to pick a render overload — it doesn't relax the
  // prop callers see above.
  const Component = Tag as ElementType;

  return (
    <Component
      ref={ref}
      className={`lp-reveal ${variantClass} ${className}`.trim()}
      data-revealed={revealed ? "true" : "false"}
      style={delay ? ({ "--lp-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Component>
  );
}
