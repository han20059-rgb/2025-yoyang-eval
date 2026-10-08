"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { RECHECK_STORAGE } from "@/lib/checks";
import { adminRolesFor, overrideMap, type AdminOverride } from "@/lib/assignmentMerge";
import type { RoleId } from "@/data/duties";

type Ctx = {
  overrides: AdminOverride[];
  map: Map<string, AdminOverride>;
  adminRoles: (id: number, mark: string) => RoleId[];
  reload: () => Promise<void>;
  storage: "idle" | "supabase" | "unready" | "anon" | "demo";
};

const AssignmentContext = createContext<Ctx | null>(null);

export function AssignmentProvider({ children }: { children: ReactNode }) {
  const { mode } = useEvalSession();
  const [overrides, setOverrides] = useState<AdminOverride[]>([]);
  const [storage, setStorage] = useState<Ctx["storage"]>("idle");

  const reload = useCallback(async () => {
    if (mode === "demo") {
      setOverrides([]);
      setStorage("demo");
      return;
    }
    const res = await fetch("/api/assignments", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) {
      setOverrides([]);
      setStorage("unready");
      return;
    }
    setOverrides((data.items || []) as AdminOverride[]);
    setStorage(data.storage === "supabase" ? "supabase" : "anon");
  }, [mode]);

  useEffect(() => {
    void reload();
    const onAdmin = () => void reload();
    window.addEventListener("yoyang-admin", onAdmin);
    return () => window.removeEventListener("yoyang-admin", onAdmin);
  }, [reload]);

  const map = useMemo(() => overrideMap(overrides), [overrides]);
  const value = useMemo(
    () => ({
      overrides,
      map,
      adminRoles: (id: number, mark: string) => adminRolesFor(map, id, mark),
      reload,
      storage,
    }),
    [overrides, map, reload, storage]
  );

  return <AssignmentContext.Provider value={value}>{children}</AssignmentContext.Provider>;
}

export function useAssignments() {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("AssignmentProvider 필요");
  return ctx;
}

export function markRolesRecheck(indicatorId: number, mark: string, newRoles: RoleId[]) {
  try {
    const raw = JSON.parse(localStorage.getItem(RECHECK_STORAGE) || "[]") as string[];
    const next = new Set(raw);
    for (const r of newRoles) next.add(`${indicatorId}:${mark}:${r}`);
    localStorage.setItem(RECHECK_STORAGE, JSON.stringify([...next]));
    window.dispatchEvent(new Event("yoyang-progress"));
  } catch {
    /* ignore */
  }
}
