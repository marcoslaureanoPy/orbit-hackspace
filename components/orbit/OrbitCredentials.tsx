"use client";

import { useState } from "react";
import { useOrbitStore, type OrbitCredential } from "./useOrbitStore";

function CredRow({
  cred,
  onPatch,
  onRemove,
}: {
  cred: OrbitCredential;
  onPatch: (
    id: string,
    patch: Partial<Pick<OrbitCredential, "resource" | "secret" | "usage">>,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5 rounded-lg border border-line-soft bg-bg/50 p-2.5">
      <div className="flex items-start gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-wider text-fg-mute">
            Resource
          </span>
          <input
            value={cred.resource}
            onChange={(e) => onPatch(cred.id, { resource: e.target.value })}
            placeholder="e.g. c99.nl"
            className="w-full rounded-md border border-line-soft bg-bg px-2 py-1.5 text-[11px] text-fg placeholder:text-fg-mute focus:border-accent/40 focus:outline-none"
            aria-label="Resource"
          />
        </label>
        <button
          type="button"
          onClick={() => onRemove(cred.id)}
          className="mt-4 shrink-0 rounded px-1.5 py-0.5 text-[10px] text-fg-mute hover:bg-line-soft hover:text-fg-dim"
          aria-label="Delete credential"
          title="Delete"
        >
          ✕
        </button>
      </div>

      <label className="block">
        <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-wider text-fg-mute">
          API key / secret
        </span>
        <div className="flex gap-1">
          <input
            type={show ? "text" : "password"}
            value={cred.secret}
            onChange={(e) => onPatch(cred.id, { secret: e.target.value })}
            placeholder="••••••••"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-line-soft bg-bg px-2 py-1.5 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-accent/40 focus:outline-none"
            aria-label="API key / secret"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="shrink-0 rounded-md border border-line-soft px-2 py-1 text-[9px] uppercase tracking-wider text-fg-mute hover:border-accent/40 hover:text-accent"
            aria-label={show ? "Hide secret" : "Show secret"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <label className="block">
        <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-wider text-fg-mute">
          Usage
        </span>
        <input
          value={cred.usage}
          onChange={(e) => onPatch(cred.id, { usage: e.target.value })}
          placeholder="When / how to use this key"
          className="w-full rounded-md border border-line-soft bg-bg px-2 py-1.5 text-[11px] text-fg placeholder:text-fg-mute focus:border-accent/40 focus:outline-none"
          aria-label="Usage"
        />
      </label>
    </div>
  );
}

export function OrbitCredentials() {
  const {
    credentials,
    addCredential,
    updateCredential,
    removeCredential,
    credentialsOpen,
    setCredentialsOpen,
    mode,
    authenticated,
  } = useOrbitStore();

  const syncHint =
    mode === "live" && authenticated
      ? " · synced to server"
      : mode === "live"
        ? " · local until login"
        : " · demo local only";

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-40 w-[min(320px,calc(100vw-2rem))]">
      <div className="overflow-hidden rounded-xl border border-[rgba(61,207,176,0.28)] bg-[rgba(8,10,12,0.94)] shadow-[0_0_32px_rgba(61,207,176,0.1),0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setCredentialsOpen(!credentialsOpen)}
          className="flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-left hover:bg-accent/5"
          aria-expanded={credentialsOpen}
        >
          <div>
            <h2 className="text-[12px] font-medium tracking-wide text-fg">
              Credentials &amp; keys
            </h2>
            <p className="font-mono text-[9px] text-fg-mute">
              {credentials.length === 0
                ? `No credentials stored${syncHint}`
                : `${credentials.length} stored · known to Orbit AI${syncHint}`}
            </p>
          </div>
          <span className="font-mono text-[10px] text-fg-mute" aria-hidden>
            {credentialsOpen ? "▾" : "▸"}
          </span>
        </button>

        {credentialsOpen && (
          <div className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto p-3">
            {credentials.map((c) => (
              <CredRow
                key={c.id}
                cred={c}
                onPatch={updateCredential}
                onRemove={removeCredential}
              />
            ))}

            <button
              type="button"
              onClick={() => addCredential()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/35 bg-accent/5 px-3 py-2 text-[11px] font-medium text-accent transition-colors hover:border-accent/55 hover:bg-accent/10"
            >
              <span aria-hidden>+</span>
              Add credential
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
