"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      <span className="fig rounded-md bg-ink px-2.5 py-1 text-[11px] font-bold text-paper">
        {done}
      </span>
    );
  }

  if (error) {
    return <span className="tag text-signal">{error}</span>;
  }

  return (
    <button
      onClick={claim}
      disabled={busy}
      className="btn btn-signal px-3 py-1.5 text-[10px]"
    >
      {busy ? "Claiming…" : "Claim slot"}
      {minutesLeft !== null && !busy && (
        <span className="font-mono opacity-70">· {minutesLeft}m</span>
      )}
    </button>
  );
}
