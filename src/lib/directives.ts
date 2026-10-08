import type { RoleId } from "@/data/duties";

export type DirectiveNote = {
  at: string;
  actorName: string;
  actorId: number;
  text: string;
  status: "open" | "doing" | "done";
};

export type EvalDirective = {
  id: string;
  indicatorId: number;
  mark: string;
  targetRoles: RoleId[];
  targetStaffIds: number[];
  targetStaffNames: string[];
  body: string;
  due: string;
  authorName: string;
  authorId: number;
  createdAt: string;
  status: "open" | "doing" | "done";
  notes: DirectiveNote[];
};

export function directiveVisible(d: EvalDirective, role: RoleId | null | undefined, staffId: number, isAdmin: boolean) {
  if (isAdmin) return true;
  if (role && d.targetRoles.includes(role)) return true;
  if (staffId && d.targetStaffIds.includes(staffId)) return true;
  return false;
}
