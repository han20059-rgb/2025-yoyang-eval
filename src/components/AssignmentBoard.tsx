"use client";

import { useEffect, useMemo, useState } from "react";
import { roles, type RoleId } from "@/data/duties";
import { confirmSlice, criterionEvidence, parseEvalCriteria, rolesForCriterion } from "@/lib/evalCriteria";
import { combinedRoles, type AdminOverride } from "@/lib/assignmentMerge";
import { markRolesRecheck, useAssignments } from "@/components/AssignmentProvider";
import { adminFetch } from "@/lib/adminClient";
import type { Indicator } from "@/lib/types";

const UI_KEY = "eval-assign-ui";
const PAGE = 10;
const ROLE_OPTS = roles.filter((r) => r.id !== "all");

type Filter = "all" | "open" | "set" | "recheck";

function statusOf(manual: RoleId[], admin: RoleId[]) {
  if (manual.length || admin.length) return "set" as const;
  return "open" as const;
}

export function AssignmentBoard({ indicators }: { indicators: Indicator[] }) {
  const { adminRoles, reload, storage, map } = useAssignments();
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [roleQ, setRoleQ] = useState<RoleId | "">("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [draftRoles, setDraftRoles] = useState<RoleId[]>([]);
  const [reason, setReason] = useState("");
  const [staffNames, setStaffNames] = useState("");
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState<{ mark: string; indicatorId: number; error?: string }[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { filter?: Filter; q?: string; page?: number; openId?: number };
      if (s.filter) setFilter(s.filter);
      if (s.q) setQ(s.q);
      if (s.page) setPage(s.page);
      if (s.openId) setOpenId(s.openId);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem(UI_KEY, JSON.stringify({ filter, q, page, openId, scroll: window.scrollY }));
  }, [filter, q, page, openId]);

  const rows = useMemo(() => {
    return indicators.flatMap((i) => {
      const items = parseEvalCriteria(i.curr.criteria);
      const method = `${i.curr.method}\n${i.fullSource?.sections.confirm.text || ""}`;
      return items.map((it) => {
        const confirm = confirmSlice(method, it.mark);
        const manual = rolesForCriterion(i.id, it.mark, it.text, confirm);
        const ov = map.get(`${i.id}:${it.mark}`);
        const admin = adminRoles(i.id, it.mark);
        const combined = combinedRoles(manual, admin, ov?.excludeRoles);
        const ev = criterionEvidence(i.id, it.mark, it.text, `지표 ${i.id} · ${i.name} 기준 ${it.mark}`, confirm);
        const st = statusOf(combined.map((c) => c.role), []);
        return { i, it, manual, admin, combined, ev, st, ov, confirm };
      });
    });
  }, [indicators, adminRoles, map]);

  const counts = {
    all: rows.length,
    set: rows.filter((r) => r.st === "set").length,
    open: rows.filter((r) => r.st === "open").length,
    recheck: rows.filter((r) => (r.ov?.recheckRoles || []).length > 0).length,
  };

  const filtered = rows.filter((r) => {
    if (filter === "open" && r.st !== "open") return false;
    if (filter === "set" && r.st !== "set") return false;
    if (filter === "recheck" && !(r.ov?.recheckRoles || []).length) return false;
    const blob = `${r.i.id} ${r.i.name} ${r.it.mark} ${r.it.text}`.toLowerCase();
    if (q && !blob.includes(q.toLowerCase())) return false;
    if (roleQ && !r.combined.some((c) => c.role === roleQ)) return false;
    return true;
  });

  const byInd = useMemo(() => {
    const m = new Map<number, typeof filtered>();
    for (const r of filtered) {
      const list = m.get(r.i.id) || [];
      list.push(r);
      m.set(r.i.id, list);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(byInd.length / PAGE));
  const slice = byInd.slice(page * PAGE, page * PAGE + PAGE);

  function toggleSel(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  }

  function toggleDraft(r: RoleId) {
    setDraftRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  }

  const targets = filtered.filter((r) => selected.includes(`${r.i.id}:${r.it.mark}`));

  async function save() {
    if (!reason.trim() && targets.some((t) => draftRoles.some((r) => !t.manual.includes(r)))) {
      setMsg("원문과 다른 배정에는 변경 사유가 필요합니다.");
      return;
    }
    setMsg("저장 중");
    const changes = targets.map((t) => ({
      indicatorId: t.i.id,
      mark: t.it.mark,
      roles: draftRoles,
      excludeRoles: t.manual.filter((r) => !draftRoles.includes(r)),
      staffNames: staffNames.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      reason: reason.trim(),
    }));
    const res = await adminFetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      setFailed(changes.map((c) => ({ indicatorId: c.indicatorId, mark: c.mark, error: data.error })));
      return;
    }
    setFailed(data.failed || []);
    for (const t of targets) {
      const added = draftRoles.filter((r) => !t.admin.includes(r) && !t.manual.includes(r));
      markRolesRecheck(t.i.id, t.it.mark, added.length ? added : draftRoles);
    }
    await reload();
    setMsg(data.ok ? "저장됨" : `일부 실패 ${data.failed?.length || 0}건`);
    setPreview(false);
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs text-(--teal)">관리자 전용</p>
        <h2 className="text-xl font-bold">담당 배정 관리</h2>
        <p className="mt-1 text-[15px] leading-7 text-stone-600">
          원문 명시와 관리자 지정을 구분합니다. 기존 완료 이력은 옮기지 않습니다. 저장소: {storage === "unready" ? "미준비(저장 불가)" : storage}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["전체 기준", counts.all],
          ["배정됨", counts.set],
          ["미지정", counts.open],
          ["재확인 필요", counts.recheck],
        ].map(([k, n]) => (
          <div key={String(k)} className="rounded-xl border border-stone-200 bg-white px-3 py-2">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="text-lg font-bold">{n}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {(["all", "open", "set", "recheck"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={`min-h-11 w-full rounded-xl border px-3 text-left text-[16px] ${filter === f ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white"}`}
          >
            {f === "all" ? "전체" : f === "open" ? "미지정" : f === "set" ? "배정됨" : "재확인 필요"}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="지표·기준 검색" className="min-h-11 w-full rounded-xl border px-3" />
      <select value={roleQ} onChange={(e) => setRoleQ(e.target.value as RoleId | "")} className="min-h-11 w-full rounded-xl border px-3">
        <option value="">직종 전체</option>
        {ROLE_OPTS.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead>
            <tr className="border-b text-stone-500">
              <th className="py-2">지표</th>
              <th>상태</th>
              <th>현재 담당</th>
              <th>수정</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(([id, list]) => {
              const ind = list[0].i;
              const labels = [...new Set(list.flatMap((r) => r.combined.map((c) => c.role)))];
              return (
                <tr key={id} className="border-b">
                  <td className="py-2 font-semibold">지표 {ind.id} · {ind.name}</td>
                  <td>{list.every((r) => r.st === "open") ? "미지정" : "배정됨"}</td>
                  <td>{labels.map((r) => ROLE_OPTS.find((x) => x.id === r)?.label).join(" · ") || "—"}</td>
                  <td>
                    <button type="button" className="min-h-11 text-(--teal) underline" onClick={() => setOpenId(openId === id ? null : id)}>
                      {openId === id ? "접기" : "펼치기"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {slice.map(([id, list]) => {
          const ind = list[0].i;
          return (
            <li key={id} className="rounded-xl border bg-white">
              <button type="button" className="flex min-h-11 w-full items-center justify-between px-3 py-3 text-left" onClick={() => setOpenId(openId === id ? null : id)}>
                <span className="text-[16px] font-semibold">지표 {ind.id} · {ind.name}</span>
                <span className="text-sm text-stone-500">{list.every((r) => r.st === "open") ? "미지정" : "배정됨"} · {openId === id ? "접기" : "펼치기"}</span>
              </button>
              {openId === id ? <CriterionEditor list={list} selected={selected} onSel={toggleSel} /> : null}
            </li>
          );
        })}
      </ul>
      {openId && slice.some(([id]) => id === openId) ? (
        <div className="hidden md:block">
          <CriterionEditor list={slice.find(([id]) => id === openId)![1]} selected={selected} onSel={toggleSel} />
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-xl border" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>이전</button>
        <p className="flex min-h-11 items-center px-2 text-sm">{page + 1} / {pages}</p>
        <button type="button" className="min-h-11 flex-1 rounded-xl border" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>다음</button>
      </div>

      <section className="space-y-2 rounded-xl border bg-white p-3">
        <p className="font-semibold">선택 {selected.length}개 일괄 지정</p>
        <div className="flex flex-col gap-1">
          {ROLE_OPTS.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={draftRoles.includes(r.id)} onChange={() => toggleDraft(r.id)} />
              {r.label}
            </label>
          ))}
        </div>
        <input value={staffNames} onChange={(e) => setStaffNames(e.target.value)} placeholder="직원 이름(쉼표, 선택)" className="min-h-11 w-full rounded-xl border px-3" />
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="변경 사유(원문과 다르면 필수)" className="min-h-24 w-full rounded-xl border px-3 py-2" />
        <button type="button" className="min-h-11 w-full rounded-xl bg-(--teal) text-white" onClick={() => setPreview(true)}>저장 전 확인</button>
      </section>

      {preview ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="font-semibold">변경 미리보기</p>
          {targets.map((t) => (
            <p key={`${t.i.id}-${t.it.mark}`} className="text-[15px] leading-7">
              지표 {t.i.id} {t.it.mark}: {t.combined.map((c) => c.role).join(",") || "없음"} → {draftRoles.join(",") || "없음"}
              {draftRoles.some((r) => !t.manual.includes(r)) ? " · 원문과 다름" : ""}
            </p>
          ))}
          {targets.length === 0 ? <p>선택된 기준이 없습니다.</p> : null}
          <button type="button" className="min-h-11 w-full rounded-xl bg-(--teal) text-white" onClick={() => void save()}>저장</button>
          <button type="button" className="min-h-11 w-full rounded-xl border" onClick={() => setPreview(false)}>취소</button>
        </div>
      ) : null}
      {msg ? <p className="text-[15px] text-amber-900">{msg}</p> : null}
      {failed.length ? (
        <ul className="rounded-xl border border-red-200 bg-red-50 p-3 text-[15px]">
          {failed.map((f) => (
            <li key={`${f.indicatorId}-${f.mark}`}>지표 {f.indicatorId} {f.mark} 실패 · {f.error || "오류"}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CriterionEditor({
  list,
  selected,
  onSel,
}: {
  list: {
    i: Indicator;
    it: { mark: string; text: string };
    manual: RoleId[];
    admin: RoleId[];
    combined: { role: RoleId; kind: string }[];
    ev: { quote: string; loc: string; role: RoleId }[];
    ov?: AdminOverride;
  }[];
  selected: string[];
  onSel: (k: string) => void;
}) {
  return (
    <div className="space-y-3 border-t px-3 py-3">
      {list.map((r) => {
        const key = `${r.i.id}:${r.it.mark}`;
        return (
          <article key={key} className="rounded-xl border p-3">
            <label className="flex min-h-11 items-center gap-2 text-[16px] font-semibold">
              <input type="checkbox" checked={selected.includes(key)} onChange={() => onSel(key)} />
              {r.it.mark}
            </label>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-stone-500">원문 열기</summary>
              <p className="mt-1 text-[16px] leading-7">{r.it.text}</p>
            </details>
            <ul className="mt-2 text-[15px] leading-7">
              {r.combined.length === 0 ? <li className="text-amber-800">담당 미지정</li> : null}
              {r.combined.map((c) => (
                <li key={c.role}>{c.kind === "manual" ? "매뉴얼 명시 담당" : "관리자 지정 담당"} · {ROLE_OPTS.find((x) => x.id === c.role)?.label}</li>
              ))}
            </ul>
            {r.ev.filter((e) => r.manual.includes(e.role)).slice(0, 2).map((e) => (
              <p key={e.quote} className="mt-1 rounded-lg bg-teal-50 px-2 py-1 text-[14px]">{e.quote} · {e.loc}</p>
            ))}
            {r.ov?.reason ? <p className="mt-1 text-sm text-stone-600">지정 사유: {r.ov.reason} · {r.ov.actorName} · {r.ov.updatedAt?.slice(0, 16).replace("T", " ")}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
