"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lifts a maintenance closure.
 *
 * A manager who can close a court but never reopen it has to ask a DBA, so the
 * inverse belongs next to the closure it undoes. The server flips the row to
 * 'cancelled' rather than deleting it — the partial exclusion constraint stops
 * indexing it and the slot reopens, with the closure kept as history.
 */
export function ReopenButton({
  blockId,
  disabled,
}: {
  blockId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unblock", blockId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.message ?? "Could not reopen that window.");
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={reopen}
        disabled={disabled || busy}
        title={disabled ? "Manager access required" : "Reopen this window"}
        className="btn btn-outline shrink-0 px-2.5 py-1 text-[10px]"
      >
        {busy ? "Reopening…" : "Reopen"}
      </button>
      {error && <p className="mt-1 text-[11px] text-signal">{error}</p>}
    </>
  );
}
