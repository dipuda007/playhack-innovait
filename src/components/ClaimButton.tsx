"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertTriangle } from "lucide-react";

export function ClaimButton({
  waitlistId,
  expiresAt,
}: {
  waitlistId: string;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const minutesLeft = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000))
    : null;

  async function claim() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/waitlist/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ waitlistId }),
    });
    const body = await res.json();
    setBusy(false);

    if (body.ok) {
      setDone(body.bookingCode);
      startTransition(() => router.refresh());
    } else {
      setError(body.message ?? "That offer is no longer available.");
      startTransition(() => router.refresh());
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-go px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ground">
        <Check className="h-3 w-3" /> {done}
      </span>
    );
  }

  if (error) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-stop/20 px-3 py-1 text-[11px] text-stop">
        <AlertTriangle className="h-3 w-3" /> {error}
      </span>
    );
  }

  return (
    <button
      onClick={claim}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full bg-flame px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      Claim slot
      {minutesLeft !== null && (
        <span className="opacity-70">· {minutesLeft}m left</span>
      )}
    </button>
  );
}
