"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { roles, type RoleId } from "@/data/duties";
import { saveDemoOverrides, useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { adminFetch } from "@/lib/adminClient";
import { mapJobType } from "@/lib/jobMap";
import { encodeStaffTags, roleLabel, type SitStaff } from "@/lib/situation";
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
  staffDirError = "",
  staffDirLoading = false,
  onRetryStaffDir,
  onSaved,
  startOpen,
  allowEditAfterSave = true,
}: {
  indicatorId: number;
  mark: string;
  manual: RoleId[];
  currentRoles: RoleId[];
  currentStaff: SitStaff[];
  recheckRoles: RoleId[];
  staffDir: DirStaff[];
  staffDirError?: string;
  staffDirLoading?: boolean;
  onRetryStaffDir?: () => void;
  onSaved: () => Promise<void> | void;
  startOpen?: boolean;
  allowEditAfterSave?: boolean;
}) {
  const { mode, identity } = useEvalSession();
  const { overrides } = useAssignments();
  const saved = currentRoles.length > 0 || currentStaff.length > 0;
  const [open, setOpen] = useState(Boolean(startOpen) && !saved);
  const [pickRoles, setPickRoles] = useState<RoleId[]>(currentRoles);
  const [pickStaff, setPickStaff] = useState<SitStaff[]>(currentStaff);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleStaff = useMemo(() => {
    if (!pickRoles.length) return [];
    return staffDir.filter((s) => {
      const mapped = mapJobType(s.jobType).role;
      return Boolean(mapped && pickRoles.includes(mapped));
    });
  }, [staffDir, pickRoles]);

  function summary() {
    const bits = [...pickRoles.map(roleLabel), ...currentStaff.map((s) => s.name)];
    if (saved) {
      return [...currentRoles.map(roleLabel), ...currentStaff.map((s) => s.name)].filter(Boolean).join(" · ") || "담당 미지정";
    }
    return bits.filter(Boolean).join(" · ") || "담당 미지정";
  }

  function beginEdit() {
    setPickRoles(currentRoles);
    setPickStaff(currentStaff);
    setMsg("");
    setOpen(true);
  }

  function cancelEdit() {
    setPickRoles(currentRoles);
    setPickStaff(currentStaff);
    setMsg("");
    setOpen(false);
  }

  async function persist() {
    if (saving) return;
    if (!pickRoles.length) {
      setMsg("직종을 하나 이상 고른 뒤 저장하세요. 직원은 선택 사항입니다.");
      return;
    }
    setSaving(true);
    setMsg("저장 중");
    const payload: AdminOverride = {
      indicatorId,
      mark,
      roles: pickRoles,
      excludeRoles: manual.filter((r) => !pickRoles.includes(r)),
      recheckRoles: recheckRoles.filter((r) => pickRoles.includes(r)),
      staffNames: encodeStaffTags(pickStaff.filter((s) => s.id)),
      staffIds: pickStaff.map((s) => s.id).filter(Boolean),
      reason: "",
      actorName: identity?.name || "시연",
      updatedAt: new Date().toISOString(),
    };
    if (mode === "demo") {
      const rest = overrides.filter((o) => `${o.indicatorId}:${o.mark}` !== `${indicatorId}:${mark}`);
      saveDemoOverrides([...rest, payload]);
      setMsg("");
      setSaving(false);
      setOpen(false);
      await onSaved();
      return;
    }
    try {
      const res = await adminFetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              indicatorId,
              mark,
              roles: pickRoles,
              excludeRoles: payload.excludeRoles,
              staffNames: payload.staffNames,
              staffIds: payload.staffIds,
              reason: "",
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMsg(data.error || data.failed?.[0]?.error || "담당을 저장하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setMsg("");
      setOpen(false);
      await onSaved();
    } catch {
      setMsg("담당을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  function flipRole(id: RoleId) {
    const next = pickRoles.includes(id) ? pickRoles.filter((x) => x !== id) : [...pickRoles, id];
    setPickRoles(next);
    if (staffDirError || !staffDir.length) return;
    setPickStaff((staff) =>
      staff.filter((s) => {
        const row = staffDir.find((d) => d.leaveRecordId === s.id);
        const mapped = row ? mapJobType(row.jobType).role : null;
        return Boolean(mapped && next.includes(mapped));
      })
    );
  }

  function flipStaff(s: DirStaff) {
    const on = pickStaff.some((p) => p.id === s.leaveRecordId);
    setPickStaff(
      on ? pickStaff.filter((x) => x.id !== s.leaveRecordId) : [...pickStaff, { id: s.leaveRecordId, name: s.name }]
    );
  }

  if (!open) {
    return (
      <div className="mt-2 space-y-2">
        {saved ? <p className="text-[15px] leading-6 text-stone-700">담당 {summary()}</p> : null}
        <div className="flex flex-wrap gap-2">
          {allowEditAfterSave || !saved ? (
            <button type="button" className="min-h-11 rounded-xl bg-(--teal) px-4 text-white" onClick={beginEdit}>
              {saved ? "담당 변경" : "담당 지정"}
            </button>
          ) : null}
          <Link className="inline-flex min-h-11 items-center text-(--teal) underline" href={`/indicators/${indicatorId}#crit-${indicatorId}-${mark}`}>
            지표 상세
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-stone-600">직종을 고른 뒤 저장합니다. 직원은 선택 사항이며, 저장 전에는 집계에 반영되지 않습니다.</p>
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTS.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={saving}
            className={`min-h-11 rounded-full border px-3 ${pickRoles.includes(r.id) ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`}
            onClick={() => flipRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {pickRoles.length ? (
        <div className="space-y-2">
          <p className="text-sm text-stone-600">선택한 직종의 직원(선택). 이름은 다시 치지 않습니다.</p>
          {staffDirError ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-800">{staffDirError}</p>
              {onRetryStaffDir ? (
                <button type="button" className="min-h-11 rounded-xl border bg-white px-4" onClick={() => onRetryStaffDir()}>
                  직원 목록 다시 불러오기
                </button>
              ) : null}
            </div>
          ) : staffDirLoading ? (
            <p className="text-sm text-stone-500">직원 목록을 불러오는 중</p>
          ) : visibleStaff.length ? (
            <div className="flex flex-wrap gap-2">
              {visibleStaff.map((s) => {
                const on = pickStaff.some((p) => p.id === s.leaveRecordId);
                return (
                  <button
                    key={s.leaveRecordId}
                    type="button"
                    disabled={saving}
                    className={`min-h-11 max-w-full rounded-full border px-3 ${on ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`}
                    onClick={() => flipStaff(s)}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-stone-500">이 직종으로 연결된 직원이 목록에 없습니다. 직종만 저장할 수 있습니다.</p>
          )}
        </div>
      ) : null}
      {msg ? <p className="text-sm text-amber-800">{msg}</p> : null}
      <div className="flex gap-2 border-t border-stone-200 bg-(--card) py-2">
        <button
          type="button"
          disabled={saving || !pickRoles.length}
          className="min-h-11 flex-1 rounded-xl bg-(--teal) text-white disabled:opacity-60"
          onClick={() => void persist()}
        >
          {saving ? "저장 중" : "저장"}
        </button>
        <button type="button" disabled={saving} className="min-h-11 flex-1 rounded-xl border bg-white" onClick={cancelEdit}>
          취소
        </button>
      </div>
    </div>
  );
}