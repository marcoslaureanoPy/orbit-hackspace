/** Minimal stub so the copied Orbit executors still typecheck. Not used by the live proxy. */
export function getApiBaseUrl(): string {
  return (process.env.AGENT_BASE_URL || "http://127.0.0.1:18789/v1").replace(/\/$/, "");
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, cache: "no-store" });
}
