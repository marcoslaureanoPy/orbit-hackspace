"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { OrbitWorkspace } from "@/components/orbit/OrbitWorkspace";
import { checkOrbitAuth } from "@/lib/orbit/api";

export function OrbitAppClient() {
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const ok = await checkOrbitAuth();
    setState(ok ? "ok" : "deny");
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await checkOrbitAuth();
      if (!cancelled) setState(ok ? "ok" : "deny");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password");
        setBusy(false);
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#050607]">
        <p className="font-mono text-xs text-fg-mute">Checking session…</p>
      </div>
    );
  }

  if (state === "deny") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#050607] px-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Orbit</p>
        <h1 className="text-lg text-fg">Unlock the live workspace</h1>
        <form onSubmit={onUnlock} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access password"
            className="rounded-md border border-line-soft bg-[#0a0c0e] px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            autoFocus
          />
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#04110e] disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        <Link href="/orbit/demo" className="text-xs text-fg-mute hover:text-accent">
          Or try the mock demo
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="absolute left-3 top-3 z-50">
        <Link
          href="/orbit"
          className="rounded-full border border-line-soft bg-[rgba(8,10,12,0.9)] px-3 py-1 font-mono text-[10px] text-fg-mute backdrop-blur hover:border-accent/40 hover:text-accent"
        >
          ← Orbit
        </Link>
      </div>
      <OrbitWorkspace mode="live" />
    </>
  );
}
