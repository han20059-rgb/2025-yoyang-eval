"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { adminFetch } from "@/lib/adminClient";
import type { EvalDirective } from "@/lib/directives";
import type { RoleId } from "@/data/duties";
import type { SitStaff } from "@/lib/situation";

const DEMO_KEY = "eval-demo-directives";
const DEMO_EVENT = "eval-demo-directives";
const UNREADY_MSG = "지시 저장 기능 준비 중";

function demoSnapshot() {
  try {
    return sessionStorage.getItem(DEMO_KEY) || "[]";
  } catch {
    return "[]";
  }
}

function demoSubscribe(cb: () => void) {
  window.addEventListener(DEMO_EVENT, cb);
  return () => window.removeEventListener(DEMO_EVENT, cb);
}

function writeDemo(all: EvalDirective[]) {
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

function parseDemo(raw: string): EvalDirective[] {
  try {
    return JSON.parse(raw) as EvalDirective[];
  } catch {
    return [];
  }
}

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
  const demoRaw = useSyncExternalStore(demoSubscribe, demoSnapshot, () => "[]");
  const [liveItems, setLiveItems] = useState<EvalDirective[]>([]);
  const [liveReady, setLiveReady] = useState<"idle" | "ok" | "unready" | "auth">("idle");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const demo = mode === "demo";
  const items = demo
    ? parseDemo(demoRaw).filter((d) => d.indicatorId === indicatorId && d.mark === mark)
    : liveItems;
  const unready = !demo && liveReady === "unready";
  const canWriteLive = !demo && isAdmin && liveReady === "ok";

  useEffect(() => {
    if (mode === "demo") return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetch("/api/directives", { credentials: "include" }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401) {
          setLiveItems([]);
          setLiveReady("auth");
          return;
        }
        if (!res.ok || data.storage === "unready") {
          setLiveItems([]);
          setLiveReady("unready");
          setMsg(UNREADY_MSG);
          return;
        }
        const all = (data.items || []) as EvalDirective[];
        setLiveItems(all.filter((d) => d.indicatorId === indicatorId && d.mark === mark));
        setLiveReady("ok");
        setMsg("");
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [mode, indicatorId, mark]);

  async function save() {
    if (!body.trim()) return;
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
      const next = [d, ...parseDemo(demoSnapshot())];
      writeDemo(next);
      setBody("");
      setMsg("시연 · 메모리만 저장");
      return;
    }
    if (!canWriteLive) {
      setMsg(UNREADY_MSG);
      return;
    }
    setMsg("저장 중");
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
      setMsg(data.storage === "unready" ? UNREADY_MSG : data.error || "저장 실패");
      if (data.storage === "unready") setLiveReady("unready");
      return;
    }
    setBody("");
    setMsg("저장됨");
    const list = await fetch("/api/directives", { credentials: "include" });
    const payload = await list.json().catch(() => ({}));
    if (!list.ok || payload.storage === "unready") {
      setLiveReady("unready");
      setMsg(UNREADY_MSG);
      return;
    }
    setLiveItems(((payload.items || []) as EvalDirective[]).filter((d) => d.indicatorId === indicatorId && d.mark === mark));
  }

  async function patch(id: string, status: EvalDirective["status"]) {
    if (mode === "demo") {
      const next = parseDemo(demoSnapshot()).map((d) =>
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
      writeDemo(next);
      setNote("");
      setMsg("시연 · 메모리만 저장");
      return;
    }
    if (unready) {
      setMsg(UNREADY_MSG);
      return;
    }
    setMsg("저장 중");
    const res = await fetch("/api/directives", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.storage === "unready" ? UNREADY_MSG : data.error || "저장 실패");
      if (data.storage === "unready") setLiveReady("unready");
      return;
    }
    setMsg("저장됨");
  }

  return (
    <section className="mt-3 rounded-xl border border-stone-200 p-3">
      <p className="text-[13px] font-semibold text-stone-500">지시 · 처리 상태 (준비 완료와 별개)</p>
      {unready ? <p className="mt-2 text-[15px] text-amber-800">{UNREADY_MSG}</p> : null}
      {demo ? <p className="mt-2 text-sm text-stone-500">시연 지시는 이 브라우저 메모리에만 있습니다. 실제 저장이 아닙니다.</p> : null}
      {!demo && liveReady === "ok" && items.length === 0 ? <p className="mt-2 text-sm text-stone-500">지시 0건</p> : null}
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
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 내용" className="min-h-11 min-w-0 flex-1 rounded-xl border px-3" disabled={unready} />
            <button type="button" className="min-h-11 rounded-xl border px-3" disabled={unready} onClick={() => void patch(d.id, "doing")}>
              진행
            </button>
            <button type="button" className="min-h-11 rounded-xl border px-3" disabled={unready} onClick={() => void patch(d.id, "done")}>
              처리 완료
            </button>
          </div>
        </article>
      ))}
      {isAdmin || mode === "demo" ? (
        <div className="mt-3 space-y-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="지시 내용" className="min-h-24 w-full rounded-xl border px-3 py-2 text-[16px] leading-7" disabled={unready} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="min-h-11 rounded-xl border px-3" disabled={unready} />
          <button
            type="button"
            className="min-h-11 rounded-xl bg-(--teal) px-4 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={unready || (!demo && !canWriteLive)}
            onClick={() => void save()}
          >
            {unready ? UNREADY_MSG : "지시 저장"}
          </button>
        </div>
      ) : null}
      {msg ? <p className="text-sm">{msg}</p> : null}
    </section>
  );
}
