/**
 * Orbit ↔ NanoGrav API client (browser).
 * Auth: Bearer from localStorage ng_token and/or cookie ng_session via same-origin BFF.
 * Live chat hits /api/nanograv/chat/completions (BFF → the configured agent).
 */

export type OrbitChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OrbitChatRequest = {
  messages: OrbitChatMessage[];
  bubbleContext?: {
    title: string;
    notes: string;
    sourceContent: string;
  };
  credentialsContext?: string;
  signal?: AbortSignal;
  engine?: "fast" | "core" | "deep";
  /** Client-side abort if upstream is silent too long (default 45s). */
  timeoutMs?: number;
};

export type OrbitChatChunk = {
  type: "token" | "step" | "done" | "error";
  text?: string;
  error?: string;
};

export type OrbitCredentialDto = {
  id: string;
  resource: string;
  secret: string;
  usage: string;
};

export type CloudStatusDto = {
  includes_cloud: boolean;
  status: string | null;
  container_name: string | null;
  plan: string | null;
  message?: string | null;
};

export function getOrbitAuthHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const t = localStorage.getItem("ng_token");
    if (t) (h as Record<string, string>)["Authorization"] = `Bearer ${t}`;
  }
  return h;
}

export function hasOrbitSessionToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem("ng_token"));
  } catch {
    return false;
  }
}

/** Parse SSE / OpenAI-style stream from NanoGrav chat completions. */
export async function* streamOrbitChat(
  req: OrbitChatRequest,
): AsyncGenerator<OrbitChatChunk> {
  const messages: OrbitChatMessage[] = [...req.messages];

  if (req.credentialsContext?.trim()) {
    messages.unshift({
      role: "system",
      content:
        "Operator credentials vault (authorized engagement only). Use when needed; never echo secrets back to the user unless they ask.\n" +
        req.credentialsContext.trim(),
    });
  }

  if (req.bubbleContext) {
    const b = req.bubbleContext;
    messages.unshift({
      role: "system",
      content: [
        "You are an Orbit subagent focused on one ejected finding.",
        `Bubble title: ${b.title}`,
        b.notes.trim() ? `Operator notes: ${b.notes.trim()}` : null,
        "Source finding:",
        b.sourceContent,
        "Stay concise. Produce actionable next steps for the pentest core.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  const timeoutMs = req.timeoutMs ?? 45000;
  const ac = new AbortController();
  const onOuterAbort = () => ac.abort();
  if (req.signal) {
    if (req.signal.aborted) {
      yield { type: "error", error: "Request aborted" };
      return;
    }
    req.signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => ac.abort(),
    timeoutMs,
  );
  const bumpIdle = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => ac.abort(), timeoutMs);
  };
  const clearIdle = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (req.signal) req.signal.removeEventListener("abort", onOuterAbort);
  };

  let res: Response;
  try {
    res = await fetch("/api/nanograv/chat/completions", {
      method: "POST",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      signal: ac.signal,
      body: JSON.stringify({
        // Prefer fast for Orbit UX latency; callers can override engine.
        model:
          (req.engine || "fast") === "fast"
            ? "nanograv-fast"
            : (req.engine || "fast") === "deep"
              ? "nanograv-deep"
              : "nanograv-core",
        engine: req.engine || "fast",
        stream: true,
        messages,
        max_tokens: 2048,
      }),
    });
  } catch (err) {
    clearIdle();
    const aborted = (err as Error)?.name === "AbortError";
    yield {
      type: "error",
      error: aborted
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s — try a shorter message or retry.`
        : err instanceof Error
          ? err.message
          : "Network error talking to the agent",
    };
    return;
  }

  if (!res.ok) {
    clearIdle();
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        detail?: unknown;
        error?: { message?: string };
        message?: string;
      };
      if (typeof j?.error?.message === "string") detail = j.error.message;
      else if (typeof j?.message === "string") detail = j.message;
      else if (typeof j?.detail === "string") detail = j.detail;
      else if (j?.detail) detail = JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    yield { type: "error", error: detail };
    return;
  }

  if (!res.body) {
    clearIdle();
    yield { type: "error", error: "Empty response body" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const rawLine of parts) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          clearIdle();
          yield { type: "done" };
          return;
        }
        try {
          const chunk = JSON.parse(data) as {
            error?: { message?: string };
            choices?: Array<{ delta?: { content?: string } }>;
          };
          if (chunk.error?.message) {
            clearIdle();
            yield { type: "error", error: chunk.error.message };
            return;
          }
          const token = chunk.choices?.[0]?.delta?.content;
          if (typeof token === "string" && token.length > 0) {
            bumpIdle();
            yield { type: "token", text: token };
          }
        } catch {
          /* skip bad chunk */
        }
      }
    }
  } catch (err) {
    clearIdle();
    if ((err as Error)?.name === "AbortError") {
      yield {
        type: "error",
        error: `Timed out or aborted after ${Math.round(timeoutMs / 1000)}s idle.`,
      };
      return;
    }
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "Stream interrupted",
    };
    return;
  }
  clearIdle();
  yield { type: "done" };
}

export async function fetchOrbitCredentials(): Promise<OrbitCredentialDto[] | null> {
  try {
    const res = await fetch("/api/nanograv/orbit/credentials", {
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { credentials?: OrbitCredentialDto[] };
    return Array.isArray(data.credentials) ? data.credentials : [];
  } catch {
    return null;
  }
}

export async function syncOrbitCredentials(
  credentials: Array<{ resource: string; secret: string; usage: string }>,
): Promise<OrbitCredentialDto[] | null> {
  try {
    const res = await fetch("/api/nanograv/orbit/credentials", {
      method: "PUT",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      body: JSON.stringify({ credentials }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { credentials?: OrbitCredentialDto[] };
    return Array.isArray(data.credentials) ? data.credentials : [];
  } catch {
    return null;
  }
}

export async function createOrbitCredential(body: {
  resource: string;
  secret: string;
  usage: string;
}): Promise<OrbitCredentialDto | null> {
  try {
    const res = await fetch("/api/nanograv/orbit/credentials", {
      method: "POST",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as OrbitCredentialDto;
  } catch {
    return null;
  }
}

export async function fetchCloudStatus(): Promise<CloudStatusDto | null> {
  try {
    const res = await fetch("/api/nanograv/cloud/status", {
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CloudStatusDto;
  } catch {
    return null;
  }
}

export async function ensureCloudSandbox(): Promise<CloudStatusDto | null> {
  try {
    const res = await fetch("/api/nanograv/cloud/ensure", {
      method: "POST",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      body: "{}",
    });
    if (!res.ok) {
      try {
        return (await res.json()) as CloudStatusDto;
      } catch {
        return null;
      }
    }
    return (await res.json()) as CloudStatusDto;
  } catch {
    return null;
  }
}

export async function checkOrbitAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}


/** Full Orbit agent (tools + BFF tool loop) — same capability path as IDE without IDE changes. */
export type OrbitAgentRequest = OrbitChatRequest & {
  /** Default true: send tools and run BFF tool rounds. */
  enableTools?: boolean;
  /** OpenClaw / OpenAI "user" field — used as a stable conversation id. */
  user?: string;
};

export async function* streamOrbitAgent(
  req: OrbitAgentRequest,
): AsyncGenerator<OrbitChatChunk> {
  const timeoutMs = req.timeoutMs ?? 90000;
  const ac = new AbortController();
  const onOuterAbort = () => ac.abort();
  if (req.signal) {
    if (req.signal.aborted) {
      yield { type: "error", error: "Request aborted" };
      return;
    }
    req.signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => ac.abort(),
    timeoutMs,
  );
  const bumpIdle = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => ac.abort(), timeoutMs);
  };
  const clearIdle = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (req.signal) req.signal.removeEventListener("abort", onOuterAbort);
  };

  let res: Response;
  try {
    res = await fetch("/api/nanograv/orbit/agent", {
      method: "POST",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      signal: ac.signal,
      body: JSON.stringify({
        engine: req.engine || "fast",
        enableTools: req.enableTools !== false,
        messages: req.messages,
        credentialsContext: req.credentialsContext,
        bubbleContext: req.bubbleContext,
        user: req.user,
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    clearIdle();
    const aborted = (err as Error)?.name === "AbortError";
    yield {
      type: "error",
      error: aborted
        ? `Agent timed out after ${Math.round(timeoutMs / 1000)}s — retry or Ensure sandbox.`
        : err instanceof Error
          ? err.message
          : "Network error talking to Orbit agent",
    };
    return;
  }

  if (!res.ok) {
    clearIdle();
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        detail?: unknown;
        error?: { message?: string };
        message?: string;
      };
      if (typeof j?.error?.message === "string") detail = j.error.message;
      else if (typeof j?.message === "string") detail = j.message;
      else if (typeof j?.detail === "string") detail = j.detail;
      else if (j?.detail) detail = JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    yield { type: "error", error: detail };
    return;
  }

  if (!res.body) {
    clearIdle();
    yield { type: "error", error: "Empty agent response body" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const rawLine of parts) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          clearIdle();
          yield { type: "done" };
          return;
        }
        try {
          const chunk = JSON.parse(data) as {
            type?: string;
            text?: string;
            error?: string;
          };
          bumpIdle();
          if (chunk.type === "token" && chunk.text) {
            yield { type: "token", text: chunk.text };
          } else if (chunk.type === "step" && chunk.text) {
            yield { type: "step", text: chunk.text };
          } else if (chunk.type === "error") {
            clearIdle();
            yield { type: "error", error: chunk.error || "Agent error" };
            return;
          } else if (chunk.type === "done") {
            clearIdle();
            yield { type: "done" };
            return;
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch (err) {
    clearIdle();
    if ((err as Error)?.name === "AbortError") {
      yield {
        type: "error",
        error: `Agent timed out or aborted after ${Math.round(timeoutMs / 1000)}s idle.`,
      };
      return;
    }
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "Agent stream interrupted",
    };
    return;
  }
  clearIdle();
  yield { type: "done" };
}

export async function cloudExecCommand(
  command: string,
  timeout_sec = 30,
): Promise<{
  ok: boolean;
  container_name?: string | null;
  exit_code?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  message?: string | null;
} | null> {
  try {
    const res = await fetch("/api/nanograv/cloud/exec", {
      method: "POST",
      credentials: "include",
      headers: getOrbitAuthHeaders(),
      body: JSON.stringify({ command, timeout_sec }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      container_name?: string | null;
      exit_code?: number | null;
      stdout?: string | null;
      stderr?: string | null;
      message?: string | null;
    } | null;
    if (!data) return { ok: false, message: `HTTP ${res.status}` };
    return {
      ok: Boolean(data.ok),
      container_name: data.container_name,
      exit_code: data.exit_code,
      stdout: data.stdout,
      stderr: data.stderr,
      message: data.message || (res.ok ? null : `HTTP ${res.status}`),
    };
  } catch {
    return null;
  }
}
