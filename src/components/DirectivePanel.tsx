"use client";

import { useEffect, useState } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { adminFetch } from "@/lib/adminClient";
import type { EvalDirective } from "@/lib/directives";
import type { RoleId } from "@/data/duties";
import type { SitStaff } from "@/lib/situation";

export function DirectivePanel({
  indicatorId,
  mark,
  targetRoles,
  targetStaff,
}: {
  indicatorId: number;
  mark: string;
  targetRoles: RoleId[];
  targetStaff: SitStaff[];
}) {
  const { mode, identity } = useEvalSession();
  const isAdmin = Boolean(identity?.isAdmin);
  const [items, setItems] = useState<EvalDirective[]>([]);
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (mode === "demo") {
      try {
        const raw = sessionStorage.getItem("eval-demo-directives");
        const all = raw ? (JSON.parse(raw) as EvalDirective[]) : [];
        setItems(all.filter((d) => d.indicatorId === indicatorId && d.mark === mark));
      } catch {
        setItems([]);
      }
      return;
    }
    void fetch("/api/directives", { credentials: "include" }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const all = (data.items || []) as EvalDirective[];
      setItems(all.filter((d) => d.indicatorId === indicatorId && d.mark === mark));
    });
  }, [mode, indicatorId, mark]);

  async function save() {
    if (!body.trim()) return;
    setMsg("저장 중");
    const targetStaffIds = targetStaff.map((s) => s.id).filter(Boolean);
    if (mode === "demo") {
      const d: EvalDirective = {
        id: `demo-${Date.now()}`,
        indicatorId,
        mark,
        targetRoles,
        targetStaffIds,
        targetStaffNames: targetStaff.map((s) => s.name),
        body: body.trim(),
        due,
        authorName: identity?.name || "시연 관리자",
        authorId: identity?.leaveRecordId || 0,
        createdAt: new Date().toISOString(),
        status: "open",
        notes: [],
      };
      const raw = sessionStorage.getItem("eval-demo-directives");
      const all = raw ? (JSON.parse(raw) as EvalDirective[]) : [];
      const next = [d, ...all];
      sessionStorage.setItem("eval-demo-directives", JSON.stringify(next));
      setItems(next.filter((x) => x.indicatorId === indicatorId && x.mark === mark));
      setBody("");
      setMsg("저장됨");
      return;
    }
    const res = await adminFetch("/api/directives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indicatorId,
        mark,
        targetRoles,
        targetStaffIds,
        targetStaffNames: targetStaff.map((s) => s.name),
        body: body.trim(),
        due,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      return;
    }
    setBody("");
    setMsg("저장됨");
    const list = await fetch("/api/directives", { credentials: "include" });
    const payload = await list.json().catch(() => ({}));
    setItems(((payload.items || []) as EvalDirective[]).filter((d) => d.indicatorId === indicatorId && d.mark === mark));
  }

  async function patch(id: string, status: EvalDirective["status"]) {
    setMsg("저장 중");
    if (mode === "demo") {
      const raw = sessionStorage.getItem("eval-demo-directives");
      const all = raw ? (JSON.parse(raw) as EvalDirective[]) : [];
      const next = all.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              notes: [
                ...d.notes,
                {
                  at: new Date().toISOString(),
                  actorName: identity?.name || "",
                  actorId: identity?.leaveRecordId || 0,
                  text: note,
                  status,
                },
              ],
            }
          : d
      );
      sessionStorage.setItem("eval-demo-directives", JSON.stringify(next));
      setItems(next.filter((x) => x.indicatorId === indicatorId && x.mark === mark));
      setNote("");
      setMsg("저장됨");
      return;
    }
    const res = await fetch("/api/directives", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, note }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? "저장됨" : data.error || "저장 실패");
  }

  return (
    <section className="mt-3 rounded-xl border border-stone-200 p-3">
      <p className="text-[13px] font-semibold text-stone-500">지시 · 처리 상태 (준비 완료와 별개)</p>
      {items.map((d) => (
        <article key={d.id} className="mt-2 rounded-xl border border-stone-200 px-3 py-2 text-[15px] leading-6">
          <p>{d.body}</p>
          <p className="text-sm text-stone-500">
            {d.authorName} · {d.createdAt.slice(0, 16)} · 기한 {d.due || "없음"} · {d.status}
          </p>
          {d.notes.map((n, i) => (
            <p key={i} className="text-sm text-stone-600">
              {n.actorName} {n.status} {n.text}
            </p>
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 내용" className="min-h-11 min-w-0 flex-1 rounded-xl border px-3" />
            <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void patch(d.id, "doing")}>
              진행
            </button>
            <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void patch(d.id, "done")}>
              처리 완료
            </button>
          </div>
        </article>
      ))}
      {isAdmin || mode === "demo" ? (
        <div className="mt-3 space-y-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="지시 내용" className="min-h-24 w-full rounded-xl border px-3 py-2 text-[16px] leading-7" />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="min-h-11 rounded-xl border px-3" />
          <button type="button" className="min-h-11 rounded-xl bg-(--teal) px-4 text-white" onClick={() => void save()}>
            지시 저장
          </button>
        </div>
      ) : null}
      {msg ? <p className="text-sm">{msg}</p> : null}
    </section>
  );
}
