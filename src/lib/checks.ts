export type Checks = Record<string, boolean>;

export function mergeChecks(a: Checks, b: Checks): Checks {
  const out: Checks = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v) out[k] = true;
  }
  return out;
}

export function checksEqual(a: Checks, b: Checks) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const RECHECK_STORAGE = "yoyang-eval-recheck-v1";
export const MANUAL_RECHECK_PREVIEW_STORAGE = "yoyang-eval-manual-recheck-preview-v1";
export const ARCHIVE_STORAGE = "yoyang-eval-check-archive-v1";

export function preserveManualRecheckPreview() {
  try {
    if (localStorage.getItem(MANUAL_RECHECK_PREVIEW_STORAGE)) return;
    const old = localStorage.getItem(RECHECK_STORAGE);
    if (old && old !== "[]") localStorage.setItem(MANUAL_RECHECK_PREVIEW_STORAGE, old);
  } catch {
    /* ignore */
  }
}
