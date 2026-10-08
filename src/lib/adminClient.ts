export async function adminFetch(input: string, init: RequestInit = {}) {
  const demo = typeof window !== "undefined" && sessionStorage.getItem("eval-demo") === "1";
  const headers = new Headers(init.headers);
  if (demo) headers.set("x-eval-demo", "1");
  return fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}
