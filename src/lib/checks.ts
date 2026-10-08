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
export const ARCHIVE_STORAGE = "yoyang-eval-check-archive-v1";
