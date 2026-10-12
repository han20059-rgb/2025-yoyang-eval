"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminClient";
import type { DirStaff } from "@/components/AssignPicker";

export function useStaffDirectory(enabled: boolean) {
  const [items, setItems] = useState<DirStaff[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/staff");
      const data = (await res.json().catch(() => ({}))) as { error?: string; items?: DirStaff[] };
      if (!res.ok) {
        setItems([]);
        setError(data.error || "직원 목록을 불러오지 못했습니다.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setError("직원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  return { items, error, loading, reload };
}
