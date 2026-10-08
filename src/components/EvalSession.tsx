"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { roles, type RoleId } from "@/data/duties";
import type { StaffIdentity } from "@/lib/staffTypes";

type Mode = "anon" | "staff" | "demo";

type Ctx = {
  mode: Mode;
  identity: StaffIdentity | null;
  demoRole: RoleId;
  setDemoRole: (r: RoleId) => void;
  startDemo: () => void;
  exitDemo: () => void;
  setDemoAdmin: (v: boolean) => void;
  refresh: () => Promise<void>;
};

const EvalSessionContext = createContext<Ctx | null>(null);

const DEMO_IDENTITY: StaffIdentity = {
  leaveRecordId: 0,
  name: "시연 직원",
  jobType: "3.사회복지사",
  evalRole: "social",
  roleStatus: "mapped",
  roleNote: "시연용 가상 직원입니다.",
};

export function EvalSessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("anon");
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);
  const [demoRole, setDemoRole] = useState<RoleId>("social");

  const refresh = useCallback(async () => {
    if (sessionStorage.getItem("eval-demo") === "1") {
      setMode("demo");
      setIdentity({
        ...DEMO_IDENTITY,
        evalRole: (sessionStorage.getItem("eval-demo-role") as RoleId) || "social",
        isAdmin: sessionStorage.getItem("eval-demo-admin") !== "0",
      });
      return;
    }
    const res = await fetch("/api/staff/me", { credentials: "include" });
    if (!res.ok) {
      setMode("anon");
      setIdentity(null);
      return;
    }
    const data = await res.json();
    setMode("staff");
    setIdentity(data.identity);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (mode !== "demo") return;
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (/\/api\/(prep|staff|manuals|assignments|admin|directives|workflows)(\/|$|\?)/.test(url)) {
        return Promise.resolve(new Response(JSON.stringify({ error: "시연 모드에서는 실제 API에 접근하지 않습니다." }), { status: 403, headers: { "Content-Type": "application/json" } }));
      }
      return orig(input, init);
    };
    return () => {
      window.fetch = orig;
    };
  }, [mode]);

  const setDemoAdmin = useCallback((v: boolean) => {
    sessionStorage.setItem("eval-demo-admin", v ? "1" : "0");
    setIdentity((prev) => (prev ? { ...prev, isAdmin: v } : prev));
  }, []);

  const startDemo = useCallback(() => {
    sessionStorage.setItem("eval-demo", "1");
    sessionStorage.setItem("eval-demo-role", "social");
    sessionStorage.setItem("eval-demo-checks", "{}");
    sessionStorage.removeItem("eval-demo-view-role");
    sessionStorage.setItem("eval-demo-admin", "1");
    sessionStorage.removeItem("eval-demo-overrides");
    sessionStorage.removeItem("eval-demo-directives");
    sessionStorage.removeItem("eval-demo-workflows");
    window.dispatchEvent(new Event("yoyang-demo-progress"));
    window.dispatchEvent(new Event("yoyang-workflows"));
    window.dispatchEvent(new Event("yoyang-admin"));
    setDemoRole("social");
    setMode("demo");
    setIdentity({ ...DEMO_IDENTITY, isAdmin: true });
  }, []);

  const exitDemo = useCallback(() => {
    sessionStorage.removeItem("eval-demo");
    sessionStorage.removeItem("eval-demo-role");
    sessionStorage.removeItem("eval-demo-checks");
    sessionStorage.removeItem("eval-demo-view-role");
    sessionStorage.removeItem("eval-demo-admin");
    sessionStorage.removeItem("eval-demo-overrides");
    sessionStorage.removeItem("eval-demo-directives");
    sessionStorage.removeItem("eval-demo-workflows");
    window.dispatchEvent(new Event("yoyang-demo-progress"));
    window.dispatchEvent(new Event("yoyang-progress"));
    window.dispatchEvent(new Event("yoyang-workflows"));
    setMode("anon");
    setIdentity(null);
    setDemoRole("social");
  }, []);

  const value = useMemo(
    () => ({
      mode,
      identity,
      demoRole,
      setDemoRole: (r: RoleId) => {
        setDemoRole(r);
        sessionStorage.setItem("eval-demo-role", r);
        setIdentity((prev) =>
          prev && mode === "demo"
            ? { ...prev, evalRole: r, jobType: roles.find((x) => x.id === r)?.label || "시연 직종" }
            : prev
        );
      },
      startDemo,
      exitDemo,
      setDemoAdmin,
      refresh,
    }),
    [mode, identity, demoRole, startDemo, exitDemo, setDemoAdmin, refresh]
  );

  return <EvalSessionContext.Provider value={value}>{children}</EvalSessionContext.Provider>;
}

export function useEvalSession() {
  const ctx = useContext(EvalSessionContext);
  if (!ctx) throw new Error("EvalSessionProvider 필요");
  return ctx;
}
