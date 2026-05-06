"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AdminNoteBox({ dealId }: { dealId: string }) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitNote() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/deals/${dealId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setMessage(response.ok ? "Saved." : data?.error ?? "Unable to save note.");
      if (response.ok) setNote("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Internal note for operations"
      />
      <Button onClick={submitNote} disabled={pending}>
        Save note
      </Button>
      {message ? <p className="text-sm text-[var(--ink-soft)]">{message}</p> : null}
    </div>
  );
}
