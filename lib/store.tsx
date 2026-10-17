"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as seed from "./seed";
import { can, type Permission } from "./rbac";
import type { ActualLine, AiInteraction, AuditEvent, Contract, ImportBatch, Plan, RenewalDecision, User } from "./types";

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

type AuditInput = Pick<AuditEvent, "action" | "entity" | "entityId" | "reason" | "before" | "after">;
const eventBody = (e: Omit<AuditEvent, "hash">) => JSON.stringify([e.seq, e.companyId, e.at, e.userId, e.action, e.entity, e.entityId, e.reason, e.before, e.after, e.prevHash]);
const GENESIS = "0".repeat(64);

interface Store {
  user: User;
  setUserId: (id: string) => void;
  can: (p: Permission) => boolean;
  lines: ActualLine[];
  batches: ImportBatch[];
  contracts: Contract[];
  plans: Plan[];
  audit: AuditEvent[];
  ai: AiInteraction[];
  commitImport: (batch: Omit<ImportBatch, "importedBy" | "importedAt" | "status" | "companyId">, lines: ActualLine[], reason: string) => Promise<void>;
  rollbackImport: (batchId: string, reason: string) => Promise<void>;
  decideRenewal: (contractId: string, decision: RenewalDecision, reason: string) => Promise<void>;
  savePlan: (plan: Omit<Plan, "id" | "createdBy" | "createdAt" | "companyId">, reason: string) => Promise<void>;
  logAi: (i: Omit<AiInteraction, "id" | "at" | "userId" | "userName" | "companyId">) => void;
  verifyChain: () => Promise<{ ok: boolean; brokenAt: number | null }>;
  tamperDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("u-fin");
  const [lines, setLines] = useState<ActualLine[]>(seed.actuals);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [contracts, setContracts] = useState<Contract[]>(seed.contracts);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [ai, setAi] = useState<AiInteraction[]>([]);
  const user = seed.users.find((u) => u.id === userId)!;

  // Serialise writes so every event links to the one before it.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const tip = useRef({ seq: 0, hash: GENESIS });

  const record = useCallback((input: AuditInput, actor: User = user) => {
    chain.current = chain.current.then(async () => {
      const partial = { ...input, seq: tip.current.seq + 1, companyId: actor.companyId, at: new Date().toISOString(), userId: actor.id, userName: actor.name, prevHash: tip.current.hash };
      const hash = await sha256(eventBody(partial));
      tip.current = { seq: partial.seq, hash };
      setAudit((a) => [...a, { ...partial, hash }]);
    });
    return chain.current;
  }, [user]);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const admin = seed.users[0];
    record({ action: "import.commit", entity: "ImportBatch", entityId: "seed", reason: "Initial load of SAP actuals FY2022–Sep 2026", before: null, after: `${seed.actuals.length} rows` }, admin);
    record({ action: "budget.approve", entity: "BudgetAop", entityId: "FY2026", reason: "Board-approved AOP FY2026", before: null, after: "6 departments" }, admin);
  }, [record]);

  const guard = (p: Permission) => {
    if (!can(user.role, p)) throw new Error(`Your role (${user.role}) cannot do this.`);
  };

  const store: Store = {
    user,
    setUserId,
    can: (p) => can(user.role, p),
    lines, batches, contracts, plans, audit, ai,

    async commitImport(b, newLines, reason) {
      guard("import:commit");
      const batch: ImportBatch = { ...b, companyId: user.companyId, importedBy: user.name, importedAt: new Date().toISOString(), status: "committed" };
      setBatches((x) => [batch, ...x]);
      setLines((x) => [...x, ...newLines]);
      await record({ action: "import.commit", entity: "ImportBatch", entityId: b.id, reason, before: null, after: `${b.fileName} · ${b.rowCount} rows · sha256 ${b.fileHash.slice(0, 12)}…` });
    },

    async rollbackImport(batchId, reason) {
      guard("import:rollback");
      setLines((x) => x.filter((l) => l.batchId !== batchId));
      setBatches((x) => x.map((b) => (b.id === batchId ? { ...b, status: "rolled_back" } : b)));
      await record({ action: "import.rollback", entity: "ImportBatch", entityId: batchId, reason, before: "committed", after: "rolled_back" });
    },

    async decideRenewal(contractId, decision, reason) {
      guard("renewal:decide");
      const before = contracts.find((c) => c.id === contractId)?.decision ?? null;
      setContracts((x) => x.map((c) => (c.id === contractId ? { ...c, decision } : c)));
      await record({ action: "renewal.decide", entity: "Contract", entityId: contractId, reason, before, after: decision });
    },

    async savePlan(p, reason) {
      guard("plan:save");
      const plan: Plan = { ...p, id: `plan-${Date.now()}`, companyId: user.companyId, createdBy: user.name, createdAt: new Date().toISOString() };
      setPlans((x) => [plan, ...x]);
      const a = p.assumption;
      await record({ action: "plan.save", entity: "Plan", entityId: plan.id, reason, before: null, after: `${p.name}: infl ${a.inflationPct}% · real ${a.realGrowthPct}% · ${a.horizonYears}y` });
    },

    logAi(i) {
      setAi((x) => [{ ...i, id: `ai-${Date.now()}`, companyId: user.companyId, at: new Date().toISOString(), userId: user.id, userName: user.name }, ...x]);
    },

    async verifyChain() {
      let prev = GENESIS;
      for (const e of audit) {
        const { hash, ...rest } = e;
        if (e.prevHash !== prev || (await sha256(eventBody(rest))) !== hash) return { ok: false, brokenAt: e.seq };
        prev = hash;
      }
      return { ok: true, brokenAt: null };
    },

    // Demo only: edits a stored event without re-hashing, to show verification catching it.
    tamperDemo() {
      setAudit((a) => a.map((e, i) => (i === 0 ? { ...e, after: "999999 rows" } : e)));
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
