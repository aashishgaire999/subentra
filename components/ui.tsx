"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { roleLabel } from "@/lib/rbac";

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius)] border border-line bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "pos" | "warn" | "neg" }) {
  const toneClass = { default: "text-muted", pos: "text-pos", warn: "text-warn", neg: "text-neg" }[tone];
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${toneClass}`}>{sub}</div>}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "border border-line-strong bg-surface hover:bg-bg",
    ghost: "text-muted hover:bg-bg hover:text-fg",
    danger: "border border-neg/30 text-neg hover:bg-neg-soft",
  }[variant];
  return <button {...p} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${v} ${className}`} />;
}

export function Badge({ tone = "default", children }: { tone?: "default" | "accent" | "pos" | "warn" | "neg"; children: React.ReactNode }) {
  const t = {
    default: "bg-bg text-muted border-line",
    accent: "bg-accent-soft text-accent border-accent/20",
    pos: "bg-pos-soft text-pos border-pos/20",
    warn: "bg-warn-soft text-warn border-warn/20",
    neg: "bg-neg-soft text-neg border-neg/20",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Restricted({ what }: { what: string }) {
  const { user } = useStore();
  return (
    <Card>
      <p className="text-sm text-muted">
        {what} is not available to the <strong className="text-fg">{roleLabel[user.role]}</strong> role. Switch user in the top bar to see how access changes.
      </p>
    </Card>
  );
}

/** Every change is signed: the user's name is attached and a reason is required. */
export function SignOffDialog({ title, summary, confirmLabel = "Sign & save", onConfirm, onClose }: { title: string; summary: React.ReactNode; confirmLabel?: string; onConfirm: (reason: string) => Promise<void> | void; onClose: () => void }) {
  const { user } = useStore();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = reason.trim().length >= 10;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4" role="dialog" aria-modal="true" aria-labelledby="signoff-title">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-line bg-surface shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <h2 id="signoff-title" className="font-semibold">{title}</h2>
          <div className="mt-1 text-sm text-muted">{summary}</div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-sm font-medium" htmlFor="reason">Reason for change <span className="text-muted">(required, min 10 characters)</span></label>
          <textarea id="reason" autoFocus value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-md border border-line-strong px-3 py-2 text-sm" placeholder="e.g. Q4 reforecast agreed with CFO" />
          <p className="text-xs text-muted">Signed as <strong className="text-fg">{user.name}</strong> ({roleLabel[user.role]}). This is written to the tamper-evident audit log.</p>
          {err && <p className="text-sm text-neg">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!ok || busy} onClick={async () => {
            setBusy(true);
            try { await onConfirm(reason.trim()); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
          }}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-surface p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`h-7 rounded px-2.5 text-xs font-medium ${value === o.value ? "bg-accent text-white" : "text-muted hover:text-fg"}`}>{o.label}</button>
      ))}
    </div>
  );
}
