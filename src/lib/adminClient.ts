export async function adminFetch(input: string, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: init.headers,
  });
}
