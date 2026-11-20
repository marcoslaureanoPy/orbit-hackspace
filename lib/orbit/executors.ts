/**
 * Server-only Orbit tool executors (BFF). Not imported from client components.
 */
import { backendFetch, getApiBaseUrl } from "@/lib/api";

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|::1|\[::1\])/i;

export function isUrlAllowedForOrbitHttp(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http/https allowed" };
  }
  if (PRIVATE_HOST.test(url.hostname) || url.hostname === "metadata.google.internal") {
    return { ok: false, reason: "Blocked host (private/metadata)" };
  }
  return { ok: true, url };
}

export async function execHttpRequest(args: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout_sec?: number;
}): Promise<string> {
  const method = String(args.method || "GET").toUpperCase();
  const check = isUrlAllowedForOrbitHttp(String(args.url || ""));
  if (!check.ok) return JSON.stringify({ ok: false, error: check.reason });
  const timeout = Math.max(1, Math.min(Number(args.timeout_sec) || 15, 30));
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout * 1000);
  try {
    const headers = new Headers();
    if (args.headers && typeof args.headers === "object") {
      for (const [k, v] of Object.entries(args.headers)) {
        if (/^(host|content-length)$/i.test(k)) continue;
        headers.set(k, String(v));
      }
    }
    const init: RequestInit = { method, headers, signal: ac.signal, redirect: "follow" };
    if (args.body != null && method !== "GET" && method !== "HEAD") {
      init.body = String(args.body);
    }
    const res = await fetch(check.url.toString(), init);
    const text = await res.text();
    const snippet = text.length > 12000 ? `${text.slice(0, 12000)}…[truncated]` : text;
    return JSON.stringify({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(
        Array.from(res.headers.entries()).slice(0, 40),
      ),
      body: snippet,
    });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : "http_request failed",
    });
  } finally {
    clearTimeout(t);
  }
}

export async function execCloudShell(
  command: string,
  timeoutSec: number,
  authHeaders: HeadersInit,
): Promise<string> {
  const cmd = (command || "").trim();
  if (!cmd) return JSON.stringify({ ok: false, error: "Empty command" });
  if (cmd.length > 4000) {
    return JSON.stringify({ ok: false, error: "Command too long (max 4000)" });
  }
  const timeout_sec = Math.max(1, Math.min(Number(timeoutSec) || 30, 120));
  try {
    const res = await backendFetch("/nanograv/cloud/exec", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ command: cmd, timeout_sec }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return JSON.stringify({
        ok: false,
        error:
          "cloud/exec is not available in this standalone build. Use http_request or run tools on the connected agent.",
        status: 404,
      });
    }
    if (!res.ok) {
      return JSON.stringify({
        ok: false,
        error: data?.detail || data?.message || `HTTP ${res.status}`,
        status: res.status,
        data,
      });
    }
    return JSON.stringify({
      ok: Boolean(data.ok),
      container_name: data.container_name ?? null,
      exit_code: data.exit_code ?? null,
      stdout: data.stdout ?? null,
      stderr: data.stderr ?? null,
      message: data.message ?? null,
    });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : "cloud exec proxy failed",
      api: getApiBaseUrl(),
    });
  }
}

export async function runOrbitTool(
  name: string,
  argsJson: string,
  authHeaders: HeadersInit,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    args = { raw: argsJson };
  }
  const n = (name || "").trim().toLowerCase();
  if (n === "http_request" || n === "fetch" || n === "http") {
    return execHttpRequest({
      method: String(args.method || "GET"),
      url: String(args.url || ""),
      headers:
        args.headers && typeof args.headers === "object"
          ? (args.headers as Record<string, string>)
          : undefined,
      body: args.body != null ? String(args.body) : undefined,
      timeout_sec: Number(args.timeout_sec) || 15,
    });
  }
  if (
    n === "run_terminal_cmd" ||
    n === "shell" ||
    n === "bash" ||
    n === "run_command" ||
    n === "execute"
  ) {
    return execCloudShell(
      String(args.command || args.cmd || args.script || ""),
      Number(args.timeout_sec) || 30,
      authHeaders,
    );
  }
  return JSON.stringify({
    ok: false,
    error: `Unknown tool: ${name}`,
  });
}
