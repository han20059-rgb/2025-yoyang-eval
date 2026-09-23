"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { roles, type RoleId } from "@/data/duties";
import { mergeChecks, checksEqual, type Checks } from "@/lib/checks";
import { checkKey, parseEvalCriteria, rolesForIndicator, type EvalCriterion } from "@/lib/evalCriteria";
import { getSupabase } from "@/lib/supabase";
import type { Indicator } from "@/lib/types";

const STORAGE = "yoyang-eval-checks-v1";
const ROLE_STORAGE = "yoyang-eval-view-role-v1";
const EVENT = "yoyang-progress";

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

type Ctx = {
  viewRole: RoleId | "all";
  setViewRole: (r: RoleId | "all") => void;
  isChecked: (indicatorId: number, mark: string, role: RoleId) => boolean;
  toggle: (indicatorId: number, mark: string, role: RoleId) => void;
  statsFor: (indicator: Pick<Indicator, "id" | "curr">, onlyRole?: RoleId | "all") => IndicatorStat;
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
  const checksRaw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const roleRaw = useSyncExternalStore(subscribe, roleSnapshot, () => "all");
  const checks = useMemo(() => {
    try {
      return JSON.parse(checksRaw) as Checks;
    } catch {
      return {} as Checks;
    }
  }, [checksRaw]);
  const viewRole = (roles.some((r) => r.id === roleRaw) ? roleRaw : "all") as RoleId | "all";

  useEffect(() => {
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
  }, []);

  const setViewRole = useCallback((r: RoleId | "all") => {
    localStorage.setItem(ROLE_STORAGE, r);
    window.dispatchEvent(new Event(EVENT));
    const supabase = getSupabase();
    void supabase?.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) saveRemote(data.session.user.id);
    });
  }, []);

  const isChecked = useCallback(
    (indicatorId: number, mark: string, role: RoleId) => Boolean(checks[checkKey(indicatorId, mark, role)]),
    [checks]
  );

  const toggle = useCallback((indicatorId: number, mark: string, role: RoleId) => {
    const next = { ...readChecks() };
    const k = checkKey(indicatorId, mark, role);
    if (next[k]) delete next[k];
    else next[k] = true;
    writeChecks(next);
    const supabase = getSupabase();
    void supabase?.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) saveRemote(data.session.user.id);
    });
  }, []);

  const statsFor = useCallback(
    (indicator: Pick<Indicator, "id" | "curr">, onlyRole: RoleId | "all" = "all"): IndicatorStat => {
      const items = parseEvalCriteria(indicator.curr.criteria);
      const dept = rolesForIndicator(indicator.id);
      const target = onlyRole === "all" ? dept : dept.filter((r) => r === onlyRole || r === "all");
      if (target.length === 0) {
        return { id: indicator.id, done: 0, total: 0, left: 0, complete: true, items: [] };
      }
      const parsed: CriterionStat[] = items.map((it) => {
        const doneRoles = target.filter((r) => checks[checkKey(indicator.id, it.mark, r)]);
        const leftRoles = target.filter((r) => !checks[checkKey(indicator.id, it.mark, r)]);
        return {
          mark: it.mark,
          done: doneRoles.length,
          total: target.length,
          doneRoles,
          leftRoles,
          complete: leftRoles.length === 0 && target.length > 0,
        };
      });
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
    [checks]
  );

  const value = useMemo(
    () => ({ viewRole, setViewRole, isChecked, toggle, statsFor }),
    [viewRole, setViewRole, isChecked, toggle, statsFor]
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

export function criteriaOf(indicator: Pick<Indicator, "curr">): EvalCriterion[] {
  return parseEvalCriteria(indicator.curr.criteria);
}
