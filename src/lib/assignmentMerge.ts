import type { RoleId } from "@/data/duties";
import { roles } from "@/data/duties";

export type AdminOverride = {
  indicatorId: number;
  mark: string;
  roles: RoleId[];
  excludeRoles: RoleId[];
  recheckRoles: RoleId[];
  staffNames: string[];
  staffIds?: number[];
  reason: string;
  actorName: string;
  updatedAt: string;
};

export type RoleKind = "manual" | "admin";

export type CombinedRole = { role: RoleId; kind: RoleKind };

const ROLE_IDS = new Set(roles.map((r) => r.id));

export function asRole(id: string): RoleId | null {
  return ROLE_IDS.has(id as RoleId) && id !== "all" ? (id as RoleId) : null;
}

export function combinedRoles(manual: RoleId[], admin: RoleId[], exclude: RoleId[] = []): CombinedRole[] {
  const blocked = new Set(exclude);
  const out: CombinedRole[] = [];
  const seen = new Set<RoleId>();
  for (const r of manual) {
    if (r === "all" || seen.has(r) || blocked.has(r)) continue;
    seen.add(r);
    out.push({ role: r, kind: "manual" });
  }
  for (const r of admin) {
    if (r === "all" || seen.has(r) || blocked.has(r)) continue;
    seen.add(r);
    out.push({ role: r, kind: "admin" });
  }
  return out;
}

export function overrideMap(list: AdminOverride[]) {
  const m = new Map<string, AdminOverride>();
  for (const row of list) m.set(`${row.indicatorId}:${row.mark}`, row);
  return m;
}

export function adminRolesFor(map: Map<string, AdminOverride>, id: number, mark: string): RoleId[] {
  return map.get(`${id}:${mark}`)?.roles || [];
}
