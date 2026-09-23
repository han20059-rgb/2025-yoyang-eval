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
