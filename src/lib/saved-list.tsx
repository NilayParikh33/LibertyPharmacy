"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getProduct } from "./products";
import SavedListDrawer from "@/components/SavedListDrawer";
import SavedToast from "@/components/SavedToast";

/**
 * Saved list — the site's stand-in for a shopping cart.
 *
 * Nothing is purchasable online (see the compliance notes in products.ts), so
 * instead of a cart that leads nowhere, visitors keep a list of what they want
 * and call to have it set aside. The interaction is built to cart standards:
 * instant button feedback, a confirmation toast, and a header badge that
 * reacts, all without a page load.
 *
 * PRIVACY: the list lives in this browser's localStorage and is never sent to
 * the server — there is no network call anywhere in this module. It therefore
 * adds nothing to the PHI surface. localStorage can be unavailable (private
 * windows, blocked storage), so every access is wrapped and the list simply
 * resets per visit in that case.
 */

const STORAGE_KEY = "liberty.savedList.v1";
const MAX_QTY = 20;

export type SavedItem = { id: string; qty: number };

type ToastState = { id: number; message: string } | null;

type SavedListValue = {
  /** Saved items that still exist in the catalog, in the order saved. */
  items: SavedItem[];
  /** Number of distinct products saved — what the header badge shows. */
  count: number;
  /** False until the list has been read from storage (avoids a badge flash). */
  ready: boolean;
  has: (id: string) => boolean;
  qtyOf: (id: string) => number;
  /** Save a product, or update its quantity if it is already saved. */
  save: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  /** Heart-style toggle: save with quantity 1, or remove. */
  toggle: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  /** Increments on every save, so the header badge can replay its pop. */
  bump: number;
  drawerOpen: boolean;
  /** Open the list drawer; focus returns to `trigger` when it closes. */
  openDrawer: (trigger?: HTMLElement | null) => void;
  closeDrawer: () => void;
};

const SavedListContext = createContext<SavedListValue | null>(null);

export function useSavedList(): SavedListValue {
  const value = useContext(SavedListContext);
  if (!value) throw new Error("useSavedList must be used inside <SavedListProvider>");
  return value;
}

function clampQty(qty: number): number {
  return Math.max(1, Math.min(MAX_QTY, Math.round(qty) || 1));
}

/** Parse stored JSON defensively — it is user-controlled and may be stale. */
function parseStored(raw: string | null): SavedItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const out: SavedItem[] = [];
    for (const entry of data) {
      if (!entry || typeof entry !== "object") continue;
      const { id, qty } = entry as { id?: unknown; qty?: unknown };
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, qty: clampQty(typeof qty === "number" ? qty : 1) });
    }
    return out;
  } catch {
    return [];
  }
}

function readStorage(): SavedItem[] {
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStorage(items: SavedItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or full — the list still works for this visit.
  }
}

export function SavedListProvider({
  children,
  phone,
  phoneHref,
}: {
  children: ReactNode;
  phone: string;
  phoneHref: string;
}) {
  const [rawItems, setRawItems] = useState<SavedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on mount, and follow changes made in other tabs.
  useEffect(() => {
    setRawItems(readStorage());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRawItems(parseStored(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // Drop ids that are no longer in the catalog rather than showing blanks.
  const items = useMemo(() => rawItems.filter((i) => getProduct(i.id)), [rawItems]);

  const commit = useCallback((next: SavedItem[]) => {
    setRawItems(next);
    writeStorage(next);
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const save = useCallback(
    (id: string, qty = 1) => {
      const product = getProduct(id);
      if (!product) return;
      const q = clampQty(qty);
      const existing = rawItems.find((i) => i.id === id);
      const next = existing
        ? rawItems.map((i) => (i.id === id ? { ...i, qty: q } : i))
        : [...rawItems, { id, qty: q }];
      commit(next);
      setBump((b) => b + 1);
      showToast(existing ? `Updated ${product.name} in your list` : `Saved ${product.name} to your list`);
    },
    [rawItems, commit, showToast]
  );

  const remove = useCallback(
    (id: string) => {
      const product = getProduct(id);
      commit(rawItems.filter((i) => i.id !== id));
      if (product) showToast(`Removed ${product.name}`);
    },
    [rawItems, commit, showToast]
  );

  const toggle = useCallback(
    (id: string) => (rawItems.some((i) => i.id === id) ? remove(id) : save(id, 1)),
    [rawItems, remove, save]
  );

  const setQty = useCallback(
    (id: string, qty: number) =>
      commit(rawItems.map((i) => (i.id === id ? { ...i, qty: clampQty(qty) } : i))),
    [rawItems, commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  const openDrawer = useCallback((trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setToast(null);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Return focus to whatever opened the drawer. If that was the toast's
    // "View" button it has since unmounted, so fall back to the header button.
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus();
    else document.getElementById(SAVED_LIST_TRIGGER_ID)?.focus();
    triggerRef.current = null;
  }, []);

  const value = useMemo<SavedListValue>(
    () => ({
      items,
      count: items.length,
      ready,
      has: (id) => items.some((i) => i.id === id),
      qtyOf: (id) => items.find((i) => i.id === id)?.qty ?? 0,
      save,
      remove,
      toggle,
      setQty,
      clear,
      bump,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [items, ready, save, remove, toggle, setQty, clear, bump, drawerOpen, openDrawer, closeDrawer]
  );

  return (
    <SavedListContext.Provider value={value}>
      {children}
      {/* The drawer already shows the result of any change made inside it. */}
      {!drawerOpen && (
        <SavedToast toast={toast} onView={() => openDrawer(null)} onDismiss={() => setToast(null)} />
      )}
      {drawerOpen && <SavedListDrawer phone={phone} phoneHref={phoneHref} />}
    </SavedListContext.Provider>
  );
}

/** id of the header's saved-list button — the drawer's focus fallback. */
export const SAVED_LIST_TRIGGER_ID = "saved-list-trigger";

export { MAX_QTY };
