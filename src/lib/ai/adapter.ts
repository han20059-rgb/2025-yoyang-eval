export type ChatResult =
  | { ok: true; text: string; usage?: { prompt?: number; completion?: number } }
  | { ok: false; reason: "unconfigured" | "failed" | "canceled"; message: string };

export function aiConfigured() {
  return Boolean(process.env.EVAL_AI_API_KEY);
}

export function aiPublicStatus() {
  return {
    configured: aiConfigured(),
    model: process.env.EVAL_AI_MODEL || "",
    baseSet: Boolean(process.env.EVAL_AI_BASE_URL),
  };
}

export async function chatJson(system: string, user: string, signal?: AbortSignal): Promise<ChatResult> {
  const key = process.env.EVAL_AI_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured", message: "EVAL_AI_API_KEY가 없습니다." };
  const base = (process.env.EVAL_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.EVAL_AI_MODEL || "gpt-4o-mini";
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!res.ok) {
      return { ok: false, reason: "failed", message: data.error?.message || `AI 호출 실패 ${res.status}` };
    }
    const text = data.choices?.[0]?.message?.content || "";
    if (!text.trim()) return { ok: false, reason: "failed", message: "AI 응답이 비었습니다." };
    return {
      ok: true,
      text,
      usage: { prompt: data.usage?.prompt_tokens, completion: data.usage?.completion_tokens },
    };
  } catch (e) {
    if (signal?.aborted) return { ok: false, reason: "canceled", message: "취소되었습니다." };
    return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "AI 호출 실패" };
  }
}
