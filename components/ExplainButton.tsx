"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { explainLocally } from "@/lib/explain-local";
import { Button } from "./ui";

export type Facts = Record<string, number | string>;

/**
 * Sends ONLY the aggregate facts passed in (never raw rows) to /api/explain,
 * shows the plain-English answer, and records the call in the AI log.
 */
export function ExplainButton({ kind, facts, label = "Explain with AI" }: { kind: string; facts: () => Facts; label?: string }) {
  const { can, logAi } = useStore();
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<{ fields: string[]; redactions: number; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!can("ai:use")) return null;

  async function run() {
    setBusy(true);
    setText("");
    const f = facts();
    const show = (data: { text: string; fieldsSent: string[]; redactions: number; model: string }) => {
      setText(data.text);
      setMeta({ fields: data.fieldsSent, redactions: data.redactions, model: data.model });
      logAi({ kind, fieldsSent: data.fieldsSent, redactions: data.redactions, model: data.model, summary: String(data.text).slice(0, 180) });
    };
    try {
      const res = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, facts: f }) });
      const data = await res.json();
      if (res.status === 429) return setText(data.error);
      if (!res.ok) throw new Error(data.error);
      show(data);
    } catch {
      // No server route (static hosting) or AI unreachable: explain in the browser, nothing leaves the page.
      show({ text: explainLocally(kind, f), fieldsSent: Object.keys(f), redactions: 0, model: "built-in explainer (no data leaves the browser)" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print">
      <Button variant="secondary" onClick={run} disabled={busy}>
        <span aria-hidden className="text-accent">✦</span> {busy ? "Thinking…" : label}
      </Button>
      {text && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-32px))] rounded-[var(--radius)] border border-line bg-surface shadow-xl" role="status">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold"><span className="text-accent">✦</span> AI explanation</span>
            <button className="text-sm text-muted hover:text-fg" onClick={() => setText("")} aria-label="Close">✕</button>
          </div>
          <p className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed">{text}</p>
          {meta && (
            <div className="border-t border-line px-4 py-2 text-xs text-muted">
              AI saw {meta.fields.length} totals only · {meta.redactions} values redacted · {meta.model} · logged
            </div>
          )}
        </div>
      )}
    </div>
  );
}
