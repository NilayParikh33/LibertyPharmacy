"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/portal");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={onLogout} disabled={busy} className="btn-outline !py-2 disabled:opacity-60">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
