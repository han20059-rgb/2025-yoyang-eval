import { roles, type RoleId } from "@/data/duties";
import { combinedRoles, type AdminOverride, type CombinedRole } from "@/lib/assignmentMerge";
import { checkKey, confirmSlice, criteriaFromIndicator, rolesForCriterion, staffCheckKey } from "@/lib/evalCriteria";
import type { Checks } from "@/lib/checks";
import type { Indicator } from "@/lib/types";

export type SitFilter = "done" | "open" | "unassigned" | "recheck";

export type SitStaff = { id: number; name: string };

export type SitRow = {
  key: string;
  indicatorId: number;
  name: string;
  mark: string;
  text: string;
  manual: RoleId[];
  admin: RoleId[];
  combined: CombinedRole[];
  staff: SitStaff[];
  exclude: RoleId[];
  recheckRoles: RoleId[];
  assigned: boolean;
  done: boolean;
  recheck: boolean;
  confirm: string;
};

export function parseStaffTags(names: string[], ids?: number[]): SitStaff[] {
  if (ids?.length) {
    return names.map((name, i) => ({ name: name.replace(/\|#\d+$/, ""), id: Number(ids[i] || 0) })).filter((s) => s.name);
  }
  return names.map((raw) => {
    const m = String(raw).match(/^(.*)\|\#(\d+)$/);
    if (m) return { name: m[1], id: Number(m[2]) };
    return { name: String(raw), id: 0 };
  }).filter((s) => s.name);
}

export function encodeStaffTags(staff: SitStaff[]) {
  return staff.filter((s) => s.name).map((s) => (s.id ? `${s.name}|#${s.id}` : s.name));
}

export function roleLabel(id: RoleId) {
  return roles.find((r) => r.id === id)?.label || id;
}

export function assigneeSummary(row: SitRow) {
  const rolePart = row.combined.map((c) => roleLabel(c.role));
  const staffPart = row.staff.map((s) => s.name);
  const bits = [...new Set([...staffPart, ...rolePart])];
  if (!bits.length) return "담당 미지정";
  if (bits.length === 1) return bits[0];
  return `${bits[0]} 외 ${bits.length - 1}`;
}

export function buildSitRows(
  indicators: Indicator[],
  map: Map<string, AdminOverride>,
  checks: Checks,
  extraRecheck: (id: number, mark: string) => boolean
): SitRow[] {
  return indicators.flatMap((i) => {
    const items = criteriaFromIndicator(i);
    const method = `${i.curr.method}\n${i.fullSource?.sections.confirm.text || ""}`;
    return items.map((it) => {
      const confirm = confirmSlice(method, it.mark);
      const ov = map.get(`${i.id}:${it.mark}`);
      const manual = rolesForCriterion(i.id, it.mark, it.text, confirm);
      const admin = (ov?.roles || []) as RoleId[];
      const exclude = (ov?.excludeRoles || []) as RoleId[];
      const combined = combinedRoles(manual, admin, exclude);
      const staff = parseStaffTags(ov?.staffNames || [], ov?.staffIds);
      const assigned = combined.length > 0 || staff.length > 0;
      const checkRoles = combined.map((c) => c.role);
      const namedStaff = staff.filter((s) => s.id);
      const rolesDone = checkRoles.length === 0 || checkRoles.every((r) => checks[checkKey(i.id, it.mark, r)]);
      const staffDone = namedStaff.length === 0 || namedStaff.every((s) => checks[staffCheckKey(i.id, it.mark, s.id)]);
      const done = assigned && rolesDone && staffDone && (checkRoles.length > 0 || namedStaff.length > 0);
      const recheck = (ov?.recheckRoles || []).length > 0 || extraRecheck(i.id, it.mark);
      return {
        key: `${i.id}:${it.mark}`,
        indicatorId: i.id,
        name: i.name,
        mark: it.mark,
        text: it.text,
        manual,
        admin,
        combined,
        staff,
        exclude,
        recheckRoles: ov?.recheckRoles || [],
        assigned,
        done,
        recheck,
        confirm,
      };
    });
  });
}

export function sitCounts(rows: SitRow[]) {
  return {
    done: rows.filter((r) => r.done).length,
    open: rows.filter((r) => !r.done).length,
    unassigned: rows.filter((r) => !r.assigned).length,
    recheck: rows.filter((r) => r.recheck).length,
    all: rows.length,
  };
}

export function sitProblemScore(r: SitRow) {
  if (!r.assigned) return 0;
  if (r.recheck) return 1;
  if (!r.done) return 2;
  return 3;
}

export function matchesFilter(r: SitRow, f: SitFilter | "all") {
  if (f === "all") return true;
  if (f === "done") return r.done;
  if (f === "open") return !r.done;
  if (f === "unassigned") return !r.assigned;
  return r.recheck;
}

export function mineRows(rows: SitRow[], role: RoleId | null | undefined, staffId: number, isAdmin: boolean) {
  if (isAdmin) return rows;
  return rows.filter((r) => r.combined.some((c) => c.role && c.role === role) || r.staff.some((s) => s.id && s.id === staffId));
}

export type AssigneeGroup = {
  key: string;
  kind: "role" | "staff" | "unassigned";
  label: string;
  open: number;
  recheck: number;
  total: number;
  rows: SitRow[];
};

export function assigneeGroups(rows: SitRow[]): AssigneeGroup[] {
  const map = new Map<string, { label: string; kind: "role" | "staff"; rows: SitRow[] }>();
  const unassigned: SitRow[] = [];
  for (const r of rows) {
    if (!r.assigned) {
      unassigned.push(r);
      continue;
    }
    const seen = new Set<string>();
    for (const c of r.combined) {
      const key = `role:${c.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = map.get(key) || { label: roleLabel(c.role), kind: "role" as const, rows: [] };
      cur.rows.push(r);
      map.set(key, cur);
    }
    for (const s of r.staff) {
      const key = `staff:${s.id || s.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = map.get(key) || { label: s.name, kind: "staff" as const, rows: [] };
      cur.rows.push(r);
      map.set(key, cur);
    }
  }
  const groups: AssigneeGroup[] = [...map.entries()].map(([key, g]) => ({
    key,
    kind: g.kind,
    label: g.label,
    total: g.rows.length,
    open: g.rows.filter((x) => !x.done).length,
    recheck: g.rows.filter((x) => x.recheck).length,
    rows: g.rows,
  }));
  groups.sort((a, b) => b.open + b.recheck - (a.open + a.recheck) || a.label.localeCompare(b.label, "ko"));
  if (unassigned.length) {
    groups.push({
      key: "unassigned",
      kind: "unassigned",
      label: "담당 미지정",
      total: unassigned.length,
      open: unassigned.length,
      recheck: unassigned.filter((x) => x.recheck).length,
      rows: unassigned,
    });
  }
  return groups;
}
