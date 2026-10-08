"use client";

import { useState } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { useWorkflows } from "@/components/WorkflowProvider";
import type { Proposal } from "@/lib/workflows/types";

function Compare({ p }: { p: Proposal }) {
  return (
    <div className="grid gap-2 text-[15px] leading-7 sm:grid-cols-2">
      <div className="rounded-xl bg-stone-50 p-3">
        <p className="text-xs text-stone-500">기존</p>
        <p>{p.before ? `${p.before.name} · ${p.before.shortFlow}` : "없음(신규)"}</p>
      </div>
      <div className="rounded-xl bg-teal-50 p-3">
        <p className="text-xs text-stone-500">제안</p>
        <p>
          {p.proposed.name} · {p.proposed.shortFlow}
        </p>
      </div>
    </div>
  );
}

export default function AiReviewPage() {
  const { mode } = useEvalSession();
  const { state, persistNote, decide, restore, runReview, cancelReview } = useWorkflows();
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const open = state.proposals.filter((p) => p.status === "open");

  async function act(action: "apply" | "hold" | "exclude", id: string) {
    const note = reason[id] || "";
    if ((action === "hold" || action === "exclude") && !note.trim()) {
      setMsg("보류·제외는 이유를 적어야 합니다.");
      return;
    }
    setMsg(await decide(action, id, note));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">AI 연결 검토</h2>
        <p className="mt-1 text-[15px] leading-7 text-stone-600">적용 전에는 직원 화면에 나가지 않습니다. 준비 체크는 바꾸지 않습니다.</p>
        {mode === "demo" ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">시연 · 메모리만 · 실제 DB·AI가 아닙니다.</p> : null}
        <p className="text-sm text-stone-500">{persistNote}</p>
        {state.staleOriginal ? <p className="text-sm text-amber-800">원문이 바뀐 것 같습니다. 재검토가 필요합니다.</p> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="min-h-11 rounded-xl bg-(--teal) px-4 text-white"
          onClick={async () => setMsg(await runReview())}
        >
          검토 실행
        </button>
        <button type="button" className="min-h-11 rounded-xl border px-4" onClick={async () => setMsg(await cancelReview())}>
          취소
        </button>
      </div>
      {msg ? <p className="text-[15px] leading-7">{msg}</p> : null}
      <ul className="space-y-3">
        {open.map((p) => (
          <li key={p.id} className="rounded-2xl border border-(--line) bg-(--card) p-4">
            <p className="text-xs text-stone-500">
              {p.kind === "new" ? "새 연결 후보" : p.kind === "edit" ? "수정 후보" : p.kind === "error" ? "오류·삭제 검토" : "빠진 조건"}
              {p.sample ? " · 시연용 예시" : ""}
            </p>
            <h3 className="text-[17px] font-semibold">{p.proposed.name}</h3>
            <Compare p={p} />
            <p className="mt-2">{p.reason}</p>
            <p className="text-sm">관련 지표 {p.proposed.indicatorIds.join(", ")}</p>
            <div className="mt-2 text-[14px] leading-6">
              <p className="font-semibold">원문으로 확인된 사실</p>
              {p.facts.map((f) => (
                <p key={f}>{f}</p>
              ))}
              <p className="mt-1 font-semibold">AI의 해석</p>
              {p.interpretations.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
            {p.sources.map((s, i) => (
              <p key={i} className="text-sm text-stone-600">
                지표 {s.indicatorId}
                {s.mark || ""} {s.filePage ? `파일 ${s.filePage}쪽` : ""} {s.visualCheck ? "원문 육안 확인 필요" : ""} {s.quote}
              </p>
            ))}
            {p.visualCheck ? <p className="text-sm text-amber-800">표·그림 추출이 불완전할 수 있어 원문 육안 확인이 필요합니다.</p> : null}
            <textarea
              value={reason[p.id] || ""}
              onChange={(e) => setReason((m) => ({ ...m, [p.id]: e.target.value }))}
              placeholder="수정 메모 또는 보류·제외 이유"
              className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 text-[16px]"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button type="button" className="min-h-11 rounded-xl bg-(--teal) px-3 text-white" onClick={() => void act("apply", p.id)}>
                적용
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border px-3"
                onClick={() =>
                  void decide("apply", p.id, reason[p.id] || "수정 후 적용", {
                    description: `${p.proposed.description}\n${reason[p.id] || ""}`,
                  }).then(setMsg)
                }
              >
                수정 후 적용
              </button>
              <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void act("hold", p.id)}>
                보류
              </button>
              <button type="button" className="min-h-11 rounded-xl border px-3" onClick={() => void act("exclude", p.id)}>
                제외
              </button>
            </div>
          </li>
        ))}
      </ul>
      {open.length === 0 ? <p className="text-sm text-stone-500">열린 후보가 없습니다. 검토 실행으로 후보를 불러오세요.</p> : null}
      <section>
        <h3 className="font-semibold">확정된 연결 · 복원</h3>
        <ul className="mt-2 space-y-2">
          {state.workflows
            .filter((w) => w.status === "approved")
            .map((w) => (
              <li key={w.id} className="rounded-xl border p-3">
                <p>
                  {w.name} {w.recheck ? "· 재확인 필요" : ""}
                </p>
                {w.history.slice(-3).map((h) => (
                  <button key={h.id} type="button" className="mt-1 block min-h-11 text-left text-sm text-(--teal) underline" onClick={() => void restore(w.id, h.id).then(setMsg)}>
                    {h.at.slice(0, 16)} {h.action} 복원
                  </button>
                ))}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
