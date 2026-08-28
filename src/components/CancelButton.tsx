"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      <span className="tag text-ink-2">Cancelled · next in queue offered</span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn btn-outline px-3 py-1.5 text-[10px]"
      >
        Cancel
      </button>
    );
  }

  return (
    <span className="flex items-center gap-px bg-rule">
      <button
        onClick={cancel}
        disabled={busy}
        className="btn btn-signal px-3 py-1.5 text-[10px]"
      >
        {busy ? "Releasing…" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="btn btn-outline px-2.5 py-1.5 text-[10px]"
        aria-label="Keep booking"
      >
        Keep
      </button>
    </span>
  );
}
