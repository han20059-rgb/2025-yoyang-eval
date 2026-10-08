"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { roles, type RoleId } from "@/data/duties";
import { useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { mergeChecks, checksEqual, RECHECK_STORAGE, type Checks } from "@/lib/checks";
import { combinedRoles } from "@/lib/assignmentMerge";
import { parseStaffTags } from "@/lib/situation";
import { checkKey, confirmSlice, criteriaFromIndicator, rolesForCriterion } from "@/lib/evalCriteria";
import { getSupabase } from "@/lib/supabase";
import type { Indicator } from "@/lib/types";

const STORAGE = "yoyang-eval-checks-v1";
const ROLE_STORAGE = "yoyang-eval-view-role-v1";
const EVENT = "yoyang-progress";
const DEMO_STORAGE = "eval-demo-checks";
const DEMO_ROLE = "eval-demo-view-role";
const DEMO_EVENT = "yoyang-demo-progress";

function readChecks(): Checks {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? (JSON.parse(raw) as Checks) : {};
  } catch {
    return {};
  }
}

function writeChecks(next: Checks) {
  localStorage.setItem(STORAGE, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(STORAGE) || "{}";
  } catch {
    return "{}";
  }
}

function roleSnapshot() {
  try {
    return localStorage.getItem(ROLE_STORAGE) || "all";
  } catch {
    return "all";
  }
}

function recheckSnapshot() {
  try {
    return localStorage.getItem(RECHECK_STORAGE) || "[]";
  } catch {
    return "[]";
  }
}

function demoSnapshot() {
  try {
    return sessionStorage.getItem(DEMO_STORAGE) || "{}";
  } catch {
    return "{}";
  }
}

function demoRoleSnapshot() {
  try {
    return sessionStorage.getItem(DEMO_ROLE) || "";
  } catch {
    return "";
  }
}

function demoSubscribe(cb: () => void) {
  window.addEventListener(DEMO_EVENT, cb);
  return () => window.removeEventListener(DEMO_EVENT, cb);
}

function writeDemoChecks(next: Checks) {
  sessionStorage.setItem(DEMO_STORAGE, JSON.stringify(next));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

export type CriterionStat = {
  mark: string;
  done: number;
  total: number;
  doneRoles: RoleId[];
  leftRoles: RoleId[];
  complete: boolean;
};

export type IndicatorStat = {
  id: number;
  done: number;
  total: number;
  left: number;
  complete: boolean;
  items: CriterionStat[];
};

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "unready";

export type PrepEvent = {
  indicator_id: number;
  mark: string;
  role: string;
  action: string;
  actor_name: string;
  as_admin: boolean;
  created_at: string;
};

type Ctx = {
  viewRole: RoleId | "all";
  setViewRole: (r: RoleId | "all") => void;
  isChecked: (indicatorId: number, mark: string, role: RoleId | string) => boolean;
  needsRecheck: (indicatorId: number, mark: string) => boolean;
  toggle: (indicatorId: number, mark: string, role: RoleId | string) => void;
  statsFor: (indicator: Pick<Indicator, "id" | "curr">, onlyRole?: RoleId | "all") => IndicatorStat;
  checks: Checks;
  saveStatus: SaveStatus;
  saveMessage: string;
  recentEvents: PrepEvent[];
};

const ProgressContext = createContext<Ctx | null>(null);

async function pullAndMerge(userId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.from("eval_progress").select("checks, view_role").eq("user_id", userId).maybeSingle();
  const local = readChecks();
  const remote = (data?.checks as Checks | undefined) || {};
  const merged = mergeChecks(local, remote);
  if (!checksEqual(merged, local)) writeChecks(merged);
  if (data?.view_role && !localStorage.getItem(ROLE_STORAGE)) {
    localStorage.setItem(ROLE_STORAGE, data.view_role);
    window.dispatchEvent(new Event(EVENT));
  }
  if (!data || !checksEqual(merged, remote)) {
    await supabase.from("eval_progress").upsert({
      user_id: userId,
      checks: merged,
      view_role: localStorage.getItem(ROLE_STORAGE) || data?.view_role || "all",
      updated_at: new Date().toISOString(),
    });
  }
}

let saveTimer: number | undefined;
function saveRemote(userId: string) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.from("eval_progress").upsert({
      user_id: userId,
      checks: readChecks(),
      view_role: localStorage.getItem(ROLE_STORAGE) || "all",
      updated_at: new Date().toISOString(),
    });
  }, 300);
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { mode, identity } = useEvalSession();
  const { adminRoles, map: assignMap } = useAssignments();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [recentEvents, setRecentEvents] = useState<PrepEvent[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    setStorageReady(true);
  }, []);
  const checksRawLive = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const demoChecksRawLive = useSyncExternalStore(demoSubscribe, demoSnapshot, () => "{}");
  const roleRawLive = useSyncExternalStore(subscribe, roleSnapshot, () => "all");
  const demoRoleRawLive = useSyncExternalStore(demoSubscribe, demoRoleSnapshot, () => "");
  const recheckRawLive = useSyncExternalStore(subscribe, recheckSnapshot, () => "[]");
  const checksRaw = storageReady ? checksRawLive : "{}";
  const demoChecksRaw = storageReady ? demoChecksRawLive : "{}";
  const roleRaw = storageReady ? roleRawLive : "all";
  const demoRoleRaw = storageReady ? demoRoleRawLive : "";
  const recheckRaw = storageReady ? recheckRawLive : "[]";
  const checks = useMemo(() => {
    try {
      return JSON.parse(mode === "demo" ? demoChecksRaw : checksRaw) as Checks;
    } catch {
      return {} as Checks;
    }
  }, [checksRaw, demoChecksRaw, mode]);
  const viewRole = (
    mode === "demo"
      ? demoRoleRaw && roles.some((r) => r.id === demoRoleRaw)
        ? demoRoleRaw
        : identity?.evalRole || "social"
      : identity?.evalRole && roleRaw === "all" && mode !== "anon"
        ? identity.evalRole
        : roles.some((r) => r.id === roleRaw)
          ? roleRaw
          : "all"
  ) as RoleId | "all";

  useEffect(() => {
    if (mode === "demo") {
      setSaveStatus("idle");
      setSaveMessage("시연 데이터는 메모리에만 있습니다.");
      return;
    }
    if (mode !== "staff") return;
    void (async () => {
      const res = await fetch("/api/prep", { credentials: "include" });
      if (res.status === 503) {
        setSaveStatus("unready");
        setSaveMessage("기관 현황 DB가 아직 없습니다. 브라우저 값은 임시 캐시일 뿐입니다.");
        return;
      }
      if (!res.ok) {
        setSaveStatus("failed");
        setSaveMessage("기관 현황을 읽지 못했습니다.");
        return;
      }
      const data = await res.json();
      const next: Checks = {};
      for (const row of data.checks || []) {
        if (row.done) next[checkKey(row.indicator_id, row.mark, row.role)] = true;
      }
      writeChecks(next);
      setRecentEvents((data.events || []) as PrepEvent[]);
      setSaveStatus("saved");
      setSaveMessage("기관 현황을 불러왔습니다.");
    })();
  }, [mode]);

  useEffect(() => {
    if (mode === "demo") return;
    const supabase = getSupabase();
    if (!supabase) return;
    let userId: string | null = null;
    supabase.auth.getSession().then(({ data }) => {
      userId = data.session?.user.id ?? null;
      if (userId) void pullAndMerge(userId);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      userId = session?.user.id ?? null;
      if (userId) void pullAndMerge(userId);
    });
    const channel = supabase
      .channel("eval_progress_row")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "eval_progress" },
        (payload) => {
          const row = payload.new as { user_id?: string; checks?: Checks } | undefined;
          if (!row?.user_id || row.user_id !== userId) return;
          const incoming = row.checks || {};
          if (!checksEqual(incoming, readChecks())) writeChecks(incoming);
        }
      )
      .subscribe();
    return () => {
      data.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [mode]);

  const setViewRole = useCallback((r: RoleId | "all") => {
    if (mode === "demo") {
      sessionStorage.setItem(DEMO_ROLE, r);
      window.dispatchEvent(new Event(DEMO_EVENT));
      return;
    }
    localStorage.setItem(ROLE_STORAGE, r);
    window.dispatchEvent(new Event(EVENT));
    const supabase = getSupabase();
    void supabase?.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) saveRemote(data.session.user.id);
    });
  }, [mode]);

  const isChecked = useCallback(
    (indicatorId: number, mark: string, role: RoleId | string) =>
      Boolean(checks[/^s\d+$/.test(role) ? `${indicatorId}:${mark}:${role}` : checkKey(indicatorId, mark, role as RoleId)]),
    [checks]
  );

  const needsRecheck = useCallback(
    (indicatorId: number, mark: string) => {
      const ov = assignMap.get(`${indicatorId}:${mark}`);
      if (ov?.recheckRoles?.length) return true;
      try {
        const keys = JSON.parse(recheckRaw) as string[];
        return keys.some((k) => k.startsWith(`${indicatorId}:${mark}:`));
      } catch {
        return false;
      }
    },
    [recheckRaw, assignMap]
  );

  const toggle = useCallback((indicatorId: number, mark: string, role: RoleId | string) => {
    const k = /^s\d+$/.test(role) ? `${indicatorId}:${mark}:${role}` : checkKey(indicatorId, mark, role as RoleId);
    if (mode === "demo") {
      const next = { ...JSON.parse(demoSnapshot()) } as Checks;
      if (next[k]) delete next[k];
      else next[k] = true;
      writeDemoChecks(next);
      setSaveStatus("idle");
      setSaveMessage("시연 중 · 실제 저장 없음");
      return;
    }
    const prev = { ...readChecks() };
    const done = !prev[k];
    const optimistic = { ...prev };
    if (done) optimistic[k] = true;
    else delete optimistic[k];
    writeChecks(optimistic);
    setSaveStatus("saving");
    setSaveMessage("저장 중");
    void fetch("/api/prep", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicatorId, mark, role, done }),
    }).then(async (res) => {
      if (!res.ok) {
        writeChecks(prev);
        setSaveStatus("failed");
        const data = await res.json().catch(() => ({}));
        setSaveMessage(data.error || "저장 실패");
        return;
      }
      setSaveStatus("saved");
      setSaveMessage("저장됨");
    });
  }, [mode]);

  const statsFor = useCallback(
    (indicator: Pick<Indicator, "id" | "curr" | "fullSource">, onlyRole: RoleId | "all" = "all"): IndicatorStat => {
      const items = criteriaFromIndicator(indicator);
      const method = `${indicator.curr.method}\n${indicator.fullSource?.sections.confirm.text || ""}`;
      const parsed: CriterionStat[] = [];
      for (const it of items) {
        const ov = assignMap.get(`${indicator.id}:${it.mark}`);
        const dept = combinedRoles(
          rolesForCriterion(indicator.id, it.mark, it.text, confirmSlice(method, it.mark)),
          adminRoles(indicator.id, it.mark),
          ov?.excludeRoles
        ).map((c) => c.role);
        const staffIds = parseStaffTags(ov?.staffNames || [], ov?.staffIds).map((s) => s.id).filter(Boolean);
        const roleTarget = onlyRole === "all" ? dept : dept.filter((r) => r === onlyRole);
        const staffTarget = onlyRole === "all" ? staffIds : [];
        if (roleTarget.length === 0 && staffTarget.length === 0) continue;
        const doneRoles = roleTarget.filter((r) => checks[checkKey(indicator.id, it.mark, r)]);
        const leftRoles = roleTarget.filter((r) => !checks[checkKey(indicator.id, it.mark, r)]);
        const staffLeft = staffTarget.filter((id) => !checks[`${indicator.id}:${it.mark}:s${id}`]);
        parsed.push({
          mark: it.mark,
          done: doneRoles.length + (staffTarget.length - staffLeft.length),
          total: roleTarget.length + staffTarget.length,
          doneRoles,
          leftRoles,
          complete: leftRoles.length === 0 && staffLeft.length === 0 && roleTarget.length + staffTarget.length > 0,
        });
      }
      const done = parsed.filter((p) => p.complete).length;
      const total = parsed.length;
      return {
        id: indicator.id,
        done,
        total,
        left: total - done,
        complete: total > 0 && done === total,
        items: parsed,
      };
    },
    [checks, adminRoles, assignMap]
  );

  const value = useMemo(
    () => ({ viewRole, setViewRole, isChecked, needsRecheck, toggle, statsFor, checks, saveStatus, saveMessage, recentEvents }),
    [viewRole, setViewRole, isChecked, needsRecheck, toggle, statsFor, checks, saveStatus, saveMessage, recentEvents]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("ProgressProvider 필요");
  return ctx;
}

export function useProgressOptional() {
  return useContext(ProgressContext);
}

export function criteriaOf(indicator: Pick<Indicator, "id" | "curr" | "fullSource">) {
  return criteriaFromIndicator(indicator);
}
