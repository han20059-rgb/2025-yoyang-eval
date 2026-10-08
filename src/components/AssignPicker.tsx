"use client";

import { useEffect, useState } from "react";
import { roles, type RoleId } from "@/data/duties";
import { saveDemoOverrides, markRolesRecheck, useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { adminFetch } from "@/lib/adminClient";
import { encodeStaffTags, type SitStaff } from "@/lib/situation";
import type { AdminOverride } from "@/lib/assignmentMerge";

const ROLE_OPTS = roles.filter((r) => r.id !== "all");

export type DirStaff = { leaveRecordId: number; name: string; jobType: string };

export function AssignPicker({
  indicatorId,
  mark,
  manual,
  currentRoles,
  currentStaff,
  recheckRoles,
  staffDir,
  onSaved,
  compact,
}: {
  indicatorId: number;
  mark: string;
  manual: RoleId[];
  currentRoles: RoleId[];
  currentStaff: SitStaff[];
  recheckRoles: RoleId[];
  staffDir: DirStaff[];
  onSaved: () => Promise<void> | void;
  compact?: boolean;
}) {
  const { mode, identity } = useEvalSession();
  const { overrides } = useAssignments();
  const [open, setOpen] = useState(Boolean(compact));
  const [pickRoles, setPickRoles] = useState<RoleId[]>(currentRoles);
  const [pickStaff, setPickStaff] = useState<SitStaff[]>(currentStaff);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPickRoles(currentRoles);
    setPickStaff(currentStaff);
  }, [indicatorId, mark, currentRoles.join(","), currentStaff.map((s) => s.id).join(",")]);

  async function persist(rolesNext: RoleId[], staffNext: SitStaff[]) {
    const added = rolesNext.filter((r) => !currentRoles.includes(r));
    setMsg("저장 중");
    const payload: AdminOverride = {
      indicatorId,
      mark,
      roles: rolesNext,
      excludeRoles: manual.filter((r) => !rolesNext.includes(r)),
      recheckRoles: [...new Set([...recheckRoles.filter((r) => rolesNext.includes(r)), ...added])],
      staffNames: encodeStaffTags(staffNext),
      staffIds: staffNext.map((s) => s.id).filter(Boolean),
      reason: "",
      actorName: identity?.name || "시연",
      updatedAt: new Date().toISOString(),
    };
    if (mode === "demo") {
      const rest = overrides.filter((o) => `${o.indicatorId}:${o.mark}` !== `${indicatorId}:${mark}`);
      saveDemoOverrides([...rest, payload]);
      if (added.length) markRolesRecheck(indicatorId, mark, added);
      setMsg("저장됨");
      await onSaved();
      return;
    }
    const res = await adminFetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: [
          {
            indicatorId,
            mark,
            roles: rolesNext,
            excludeRoles: payload.excludeRoles,
            staffNames: payload.staffNames,
            staffIds: payload.staffIds,
            reason: "",
          },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      setPickRoles(currentRoles);
      setPickStaff(currentStaff);
      return;
    }
    if (added.length) markRolesRecheck(indicatorId, mark, added);
    setMsg(data.ok ? "저장됨" : "저장 실패");
    await onSaved();
  }

  function flipRole(id: RoleId) {
    const next = pickRoles.includes(id) ? pickRoles.filter((x) => x !== id) : [...pickRoles, id];
    setPickRoles(next);
    void persist(next, pickStaff);
  }

  function flipStaff(s: DirStaff) {
    const on = pickStaff.some((p) => p.id === s.leaveRecordId);
    const next = on
      ? pickStaff.filter((x) => x.id !== s.leaveRecordId)
      : [...pickStaff, { id: s.leaveRecordId, name: s.name }];
    setPickStaff(next);
    void persist(pickRoles, next);
  }

  const editor = (
    <div className="space-y-2">
      <p className="text-sm text-stone-600">직종 또는 직원을 고르면 바로 저장됩니다.</p>
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`min-h-11 rounded-full border px-3 ${pickRoles.includes(r.id) ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`}
            onClick={() => flipRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {staffDir.map((s) => {
          const on = pickStaff.some((p) => p.id === s.leaveRecordId);
          return (
            <button
              key={s.leaveRecordId}
              type="button"
              className={`min-h-11 rounded-full border px-3 ${on ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`}
              onClick={() => flipStaff(s)}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );

  if (compact) return <div className="mt-2">{editor}</div>;

  return (
    <div className="mt-2">
      {!open ? (
        <button type="button" className="min-h-11 rounded-xl bg-(--teal) px-4 text-white" onClick={() => setOpen(true)}>
          {currentRoles.length || currentStaff.length ? "담당 변경" : "담당 지정"}
        </button>
      ) : (
        editor
      )}
    </div>
  );
}
