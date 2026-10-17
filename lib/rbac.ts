import type { RoleId } from "./types";

export type Permission =
  | "import:commit"
  | "import:rollback"
  | "plan:save"
  | "renewal:decide"
  | "audit:view"
  | "ai:use";

// Least privilege: every permission is granted explicitly; nothing is inherited.
const matrix: Record<RoleId, Permission[]> = {
  admin: ["import:commit", "import:rollback", "plan:save", "renewal:decide", "audit:view", "ai:use"],
  finance: ["import:commit", "plan:save", "renewal:decide", "ai:use"],
  executive: ["audit:view", "ai:use"],
  viewer: [],
};

export const can = (role: RoleId, p: Permission) => matrix[role].includes(p);

export const roleLabel: Record<RoleId, string> = {
  admin: "Admin",
  finance: "Finance",
  executive: "Executive",
  viewer: "Viewer",
};
