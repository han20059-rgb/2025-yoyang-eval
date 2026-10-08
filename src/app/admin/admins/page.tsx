"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminClient";

type Row = {
  leave_record_id: number;
  name_snapshot: string;
  granted_by_leave_record_id: number | null;
  granted_at: string;
  active: boolean;
};

export default function AdminAdminsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await adminFetch("/api/admin/admins");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "목록을 읽지 못했습니다.");
      return;
    }
    setItems(data.items || []);
    setMsg("저장됨");
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(action: "grant" | "revoke", e?: FormEvent) {
    e?.preventDefault();
    const leaveRecordId = Number(id);
    if (!leaveRecordId) {
      setMsg("직원 고유 ID를 입력해 주세요. 이름만으로는 부여하지 않습니다.");
      return;
    }
    setMsg("저장 중");
    const res = await adminFetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveRecordId, nameSnapshot: name, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      return;
    }
    setMsg("저장됨");
    await load();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">관리자 권한</h2>
      <p className="text-[16px] leading-7 text-stone-600">권한은 직원 고유 ID에만 연결합니다. 마지막 관리자는 해제되지 않습니다.</p>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.leave_record_id} className="rounded-xl border bg-white px-3 py-3 text-[16px]">
            ID {r.leave_record_id} · {r.name_snapshot || "이름 스냅샷 없음"} · {r.active ? "활성" : "해제됨"}
          </li>
        ))}
      </ul>
      <form className="space-y-2 rounded-xl border bg-white p-3" onSubmit={(e) => void submit("grant", e)}>
        <input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} placeholder="직원 고유 ID" className="min-h-11 w-full rounded-xl border px-3" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="표시 이름(기록용)" className="min-h-11 w-full rounded-xl border px-3" />
        <button className="min-h-11 w-full rounded-xl bg-(--teal) text-white">고유 ID로 부여</button>
        <button type="button" className="min-h-11 w-full rounded-xl border" onClick={() => void submit("revoke")}>
          고유 ID로 해제
        </button>
      </form>
      {msg ? <p className="text-[15px] text-amber-900">{msg}</p> : null}
    </section>
  );
}
