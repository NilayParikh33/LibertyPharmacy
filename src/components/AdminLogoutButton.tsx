"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={onLogout} disabled={busy} className="btn-outline !py-2 disabled:opacity-60">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
