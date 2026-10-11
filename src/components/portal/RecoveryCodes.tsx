"use client";

import { useState } from "react";

/** Shows freshly issued recovery codes once, with copy / download / confirm. */
export default function RecoveryCodes({ codes, onDone, doneLabel = "Continue" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `Liberty Pharmacy — patient portal recovery codes\nEach code works once.\n\n${codes.join("\n")}\n`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "liberty-pharmacy-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900">Save your recovery codes</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          If you lose your phone or passkey, each of these codes signs you in once. Keep them somewhere safe — they
          won&apos;t be shown again.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-slate-50">
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={download} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-slate-50">
          Download
        </button>
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
        I&apos;ve saved these codes somewhere safe.
      </label>
      <button type="button" disabled={!saved} onClick={onDone} className="btn-primary w-full disabled:opacity-60">
        {doneLabel}
      </button>
    </div>
  );
}
