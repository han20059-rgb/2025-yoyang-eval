"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/adminClient";

type AdminRow = {
  leave_record_id: number;
  name_snapshot: string;
  granted_by_leave_record_id: number | null;
  granted_at: string;
  active: boolean;
};

type StaffRow = {
  leaveRecordId: number;
  name: string;
  jobType: string;
  dept: string;
  canLogin?: boolean;
};

type EventRow = {
  targetLeaveRecordId: number;
  actorLeaveRecordId: number;
  action: string;
  note: string;
  createdAt: string;
};

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<StaffRow | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [adminRes, staffRes] = await Promise.all([adminFetch("/api/admin/admins"), adminFetch("/api/admin/staff")]);
    const adminData = await adminRes.json();
    const staffData = await staffRes.json();
    if (!adminRes.ok) {
      setMsg(adminData.error || "관리자 목록을 읽지 못했습니다.");
      return;
    }
    if (!staffRes.ok) {
      setMsg(staffData.error || "직원 목록을 읽지 못했습니다.");
      return;
    }
    setAdmins(adminData.items || []);
    setEvents(adminData.events || []);
    setStaff(staffData.items || []);
    setMsg("");
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return staff;
    return staff.filter((s) => [s.name, s.dept, s.jobType, String(s.leaveRecordId)].some((v) => v.toLowerCase().includes(key)));
  }, [staff, q]);

  const activeAdmins = admins.filter((a) => a.active);
  const lastAdmin = activeAdmins.length <= 1;

  async function change(action: "grant" | "revoke", row: { leaveRecordId: number; name: string }) {
    if (!row.leaveRecordId) {
      setMsg("직원 고유 ID로만 권한을 바꿉니다. 이름만으로는 부여하지 않습니다.");
      return;
    }
    if (action === "revoke" && !window.confirm(`${row.name} (직원 ID ${row.leaveRecordId})의 관리자 권한을 해제할까요?`)) return;
    setBusy(true);
    setMsg("저장 중");
    const res = await adminFetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveRecordId: row.leaveRecordId, nameSnapshot: row.name, action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      return;
    }
    setPicked(null);
    setMsg(action === "grant" ? "권한을 부여했습니다." : "권한을 해제했습니다.");
    await load();
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">관리자 관리</h2>
      <p className="text-[16px] leading-7 text-stone-600">
        권한은 직원 고유 ID에만 연결합니다. 새 관리자는 기존 생년월일·비밀번호로 들어옵니다. 마지막 활성 관리자는 해제할 수 없습니다.
      </p>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">현재 관리자</h3>
        <ul className="space-y-2">
          {activeAdmins.map((r) => (
            <li key={r.leave_record_id} className="flex flex-col gap-2 rounded-xl border bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[16px] leading-6">
                {r.name_snapshot || "이름 기록 없음"} · 직원 ID {r.leave_record_id}
              </p>
              <button
                type="button"
                disabled={busy || lastAdmin}
                className="min-h-11 rounded-xl border px-3 disabled:text-stone-400"
                onClick={() => void change("revoke", { leaveRecordId: r.leave_record_id, name: r.name_snapshot || "" })}
              >
                {lastAdmin ? "마지막 관리자 · 해제 불가" : "권한 해제"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">재직 직원에서 선택</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·직종 그룹·직종 검색"
          className="min-h-11 w-full rounded-xl border px-3 text-[16px]"
        />
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {filtered.map((s) => {
            const on = activeAdmins.some((a) => a.leave_record_id === s.leaveRecordId);
            const selected = picked?.leaveRecordId === s.leaveRecordId;
            return (
              <li key={s.leaveRecordId}>
                <button
                  type="button"
                  className={`min-h-14 w-full rounded-xl border px-3 py-3 text-left text-[16px] leading-6 ${selected ? "border-(--teal) bg-(--teal-soft)" : "bg-white"}`}
                  onClick={() => setPicked(s)}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="mt-1 block text-sm text-stone-600">
                    직종 그룹 {s.dept} · {s.jobType || "직종 미기재"} · 직원 ID {s.leaveRecordId}
                    {on ? " · 관리자" : ""}
                    {s.canLogin === false ? " · 이 앱 로그인 대상 아님" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {picked ? (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[16px] leading-7">
              {picked.name} (직원 ID {picked.leaveRecordId})를 관리자로 추가합니다. 별도 비밀번호는 만들지 않습니다.
            </p>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 w-full rounded-xl bg-(--teal) text-white"
              onClick={() => void change("grant", { leaveRecordId: picked.leaveRecordId, name: picked.name })}
            >
              확인 · 권한 부여
            </button>
          </div>
        ) : null}
      </div>

      {events.length ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">부여·해제 이력</h3>
          <ul className="space-y-1 text-sm text-stone-600">
            {events.slice(0, 20).map((e, i) => (
              <li key={`${e.createdAt}-${i}`}>
                {e.createdAt?.slice(0, 16).replace("T", " ")} · {e.action === "revoke" ? "해제" : e.action === "grant" ? "부여" : e.action} · 대상 ID {e.targetLeaveRecordId} · 처리자 ID {e.actorLeaveRecordId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {msg ? <p className="text-[15px] text-amber-900">{msg}</p> : null}
    </section>
  );
}
