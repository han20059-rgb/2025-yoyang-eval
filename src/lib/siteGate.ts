import { createHmac } from "crypto";

export const SITE_GATE_COOKIE = "eval_site_gate";

export function siteAccessPassword() {
  return (process.env.SITE_ACCESS_PASSWORD || "").trim();
}

export function siteGateEnabled() {
  return Boolean(siteAccessPassword());
}

export function siteGateToken(secret: string) {
  return createHmac("sha256", secret).update("eval-site-ok").digest("hex");
}

export function siteGateCookieHeader(token: string) {
  return `${SITE_GATE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`;
}
