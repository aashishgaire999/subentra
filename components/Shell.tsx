"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "@/public/subentra-logo.png";
import { usePathname } from "next/navigation";
import { StoreProvider, useStore } from "@/lib/store";
import { company, users } from "@/lib/seed";
import { roleLabel } from "@/lib/rbac";

const nav = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard" }] },
  { group: "Forecast & Renewals", items: [{ href: "/forecast", label: "Forecast" }, { href: "/renewals", label: "Renewals" }] },
  { group: "Data", items: [{ href: "/import", label: "Import SAP actuals" }] },
  { group: "Governance", items: [{ href: "/audit", label: "Audit & AI log" }] },
];

function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-line bg-surface md:block">
      <Link href="/" aria-label="Subentra dashboard" className="flex h-14 items-center border-b border-line px-4">
        <Image src={logo} alt="SUBENTRA" className="h-auto max-h-11 w-full object-contain" preload />
      </Link>
      <nav className="space-y-5 p-3">
        {nav.map((g) => (
          <div key={g.group}>
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-subtle">{g.group}</div>
            {g.items.map((i) => {
              const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`block rounded-md px-2 py-1.5 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-bg hover:text-fg"}`}>
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function Topbar() {
  const { user, setUserId } = useStore();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <div className="text-sm text-muted">{company.name} <span className="text-subtle">· USD · FY = calendar year</span></div>
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted sm:inline">Signed in as</span>
          <select value={user.id} onChange={(e) => setUserId(e.target.value)} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm" aria-label="Switch demo user">
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {roleLabel[u.role]}</option>)}
          </select>
        </label>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        {nav.flatMap((g) => g.items).map((i) => (
          <Link key={i.href} href={i.href} className={`whitespace-nowrap rounded px-2 py-1 text-xs ${path === i.href ? "bg-accent-soft text-accent" : "text-muted"}`}>{i.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </StoreProvider>
  );
}
