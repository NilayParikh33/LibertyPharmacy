/**
 * Fixed-window rate limiter shared by every abuse-sensitive endpoint.
 *
 * In-memory and per-process, like the limiters it replaces: sufficient while
 * the app runs as a single instance, and must move to a shared store (e.g.
 * Postgres or Redis) before a second instance is added — see finding T-03 in
 * SECURITY-RISK-ANALYSIS.md.
 *
 * Each limiter's map is capped, so a client that sprays unique keys (rotating
 * IPs, or thousands of different emails) cannot grow memory without bound:
 * expired windows are swept first, then the oldest entries are evicted.
 */

interface Slot {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Counts one hit for `key`. Returns true once `key` is over its limit. */
  hit(key: string): boolean;
  /** True if `key` is currently over its limit, without counting a hit. */
  isLimited(key: string): boolean;
  /** Forgets `key` — e.g. after a successful login. */
  reset(key: string): void;
}

const MAX_KEYS = 10_000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const slots = new Map<string, Slot>();

  function sweep(now: number) {
    for (const [key, slot] of slots) {
      if (slot.resetAt <= now) slots.delete(key);
    }
    // Map iterates in insertion order, so this evicts the oldest windows.
    while (slots.size >= MAX_KEYS) {
      const oldest = slots.keys().next().value;
      if (oldest === undefined) break;
      slots.delete(oldest);
    }
  }

  return {
    hit(key) {
      const now = Date.now();
      let slot = slots.get(key);
      if (!slot || slot.resetAt <= now) {
        if (!slot) sweep(now);
        slot = { count: 0, resetAt: now + windowMs };
        slots.set(key, slot);
      }
      slot.count += 1;
      return slot.count > limit;
    },
    isLimited(key) {
      const slot = slots.get(key);
      return !!slot && slot.resetAt > Date.now() && slot.count >= limit;
    },
    reset(key) {
      slots.delete(key);
    },
  };
}
