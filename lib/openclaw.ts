/**
 * Small helper: POST to the configured OpenAI-compatible endpoint (OpenClaw or other).
 * Secrets stay on the server — never forwarded from the browser.
 */
export function agentConfig() {
  const base = (process.env.AGENT_BASE_URL || "http://127.0.0.1:18789/v1").replace(/\/$/, "");
  const key = process.env.AGENT_API_KEY || "";
  const model = process.env.AGENT_MODEL || "openclaw/default";
  const session = process.env.AGENT_SESSION || "orbit";
  return { base, key, model, session };
}

export async function agentChat(body: unknown, { stream }: { stream: boolean }) {
  const { base, key, model, session } = agentConfig();
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const upstream = {
    ...payload,
    model:
      typeof payload.model === "string" && !String(payload.model).startsWith("nanograv-")
        ? payload.model
        : model,
    stream,
    user: typeof payload.user === "string" ? payload.user : `conv:${session}`,
  };
  // OpenClaw runs its own tools; drop client-side NanoGrav tool payloads.
  delete (upstream as { tools?: unknown }).tools;
  delete (upstream as { tool_choice?: unknown }).tool_choice;
  delete (upstream as { engine?: unknown }).engine;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  return fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(upstream),
    cache: "no-store",
  });
}
