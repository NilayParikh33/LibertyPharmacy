/**
 * Motion constants shared by every staggered list on the site, so grids enter
 * with the same rhythm everywhere (see the motion system in globals.css).
 */

/** Delay between siblings entering one after another. */
export const STAGGER_MS = 80;

/**
 * Entrance delay for the item at `index` in a staggered group.
 *
 * Capped: after `maxSteps` items the rest share the last delay, so the tenth
 * card of a long grid appears as quickly as the sixth instead of making
 * someone wait most of a second for content that is already on screen.
 */
export function stagger(index: number, maxSteps = 5): number {
  return Math.min(index, maxSteps) * STAGGER_MS;
}

/** Inline style carrying an entrance delay for `.lp-enter` / `.lp-word` etc. */
export function delayStyle(ms: number): React.CSSProperties {
  return { "--lp-delay": `${ms}ms` } as React.CSSProperties;
}
