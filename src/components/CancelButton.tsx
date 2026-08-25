"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [, startTransition] = useTransition();

  async function cancel() {
    setBusy(true);
    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const body = await res.json();
    setBusy(false);
    setConfirming(false);

    // Worth surfacing inline rather than in a native alert: the release and
    // the next student's offer committed in the same transaction, so the slot
    // was never briefly unowned. A modal alert would also block the page.
    if (body.promotedUserId) setPromoted(true);

    startTransition(() => router.refresh());
  }

  if (promoted) {
    return (
      <span className="rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs text-info">
        Cancelled · next in queue offered
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-stop hover:text-stop"
      >
        Cancel
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={cancel}
        disabled={busy}
        className="flex items-center gap-1 rounded-lg bg-stop px-3 py-1.5 text-xs font-semibold text-ground disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        Confirm
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg p-1.5 text-ink-faint hover:text-ink"
        aria-label="Keep booking"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
