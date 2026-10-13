"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { preserveManualRecheckPreview } from "@/lib/checks";
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
    const demo = mode === "demo" || sessionStorage.getItem("eval-demo") === "1";
    if (demo) {
      try {
        const raw = sessionStorage.getItem("eval-demo-overrides");
        setOverrides(raw ? (JSON.parse(raw) as AdminOverride[]) : []);
      } catch {
        setOverrides([]);
      }
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
    preserveManualRecheckPreview();
    const id = window.setTimeout(() => void reload(), 0);
    const onAdmin = () => void reload();
    window.addEventListener("yoyang-admin", onAdmin);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("yoyang-admin", onAdmin);
    };
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

export function saveDemoOverrides(items: AdminOverride[]) {
  sessionStorage.setItem("eval-demo-overrides", JSON.stringify(items));
  window.dispatchEvent(new Event("yoyang-admin"));
}
