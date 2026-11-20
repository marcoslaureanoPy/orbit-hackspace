"use client";

/**
 * Cloud VPS sandbox status — Orbit + Cloud plan parity with NanoGrav IDE Cloud.
 *
 * Source: GET /api/nanograv/cloud/status → /nanograv/cloud/status
 * Action: POST /api/nanograv/cloud/ensure → queues/spawns per-user Docker sandbox
 *         ng-cloud-{userId[:8]} (API docker if present, else Redis host helper).
 *
 * Product intent: Cloud plan users get a real VPS sandbox for agent work (not chat-only).
 * Badge shows Running when the sandbox is up; Ensure starts/queues provision.
 */

import { useState } from "react";
import { useOrbitStore } from "./useOrbitStore";

const ACTIVE = new Set(["running", "ready", "active"]);
const PENDING = new Set([
  "queued",
  "provisioning",
  "pending",
  "starting",
]);

function normalizeStatus(raw: string | null | undefined): string {
  return (raw || "").trim().toLowerCase();
}

function isHostHelperStuck(status: string, message: string | null | undefined): boolean {
  if (status === "queued") return true;
  const msg = (message || "").toLowerCase();
  if (status === "provisioning") {
    return (
      msg.includes("docker unavailable") ||
      msg.includes("provision queued") ||
      msg.includes("host helper") ||
      (msg.includes("image") && msg.includes("missing"))
    );
  }
  return false;
}

export function OrbitCloudStatus() {
  const {
    cloudStatus,
    cloudBusy,
    refreshCloudStatus,
    ensureCloud,
    authenticated,
  } = useOrbitStore();
  const [expanded, setExpanded] = useState(false);

  if (!authenticated) return null;
  if (!cloudStatus) return null;
  if (!cloudStatus.includes_cloud) return null;

  const status = normalizeStatus(cloudStatus.status);
  const message = cloudStatus.message || null;
  const stuckQueued = isHostHelperStuck(status, message);
  const isActive = ACTIVE.has(status);
  const isPending = PENDING.has(status) && !stuckQueued;

  // Live sandbox → primary Running badge
  if (isActive) {
    return (
      <div className="pointer-events-auto absolute right-4 top-4 z-40 w-[min(260px,calc(100vw-2rem))] rounded-xl border border-[rgba(61,207,176,0.35)] bg-[rgba(8,10,12,0.94)] p-3 shadow-[0_0_24px_rgba(61,207,176,0.12)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-fg-mute">
              Cloud VPS
            </p>
            <p className="mt-0.5 text-[13px] font-semibold tracking-wide text-accent">
              Running
              <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />
            </p>
            <p className="mt-1 text-[10px] leading-snug text-fg-mute">
              Sandbox ready for agent tools &amp; Play execution.
            </p>
            {cloudStatus.container_name && (
              <p className="mt-0.5 truncate font-mono text-[9px] text-fg-mute">
                {cloudStatus.container_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refreshCloudStatus()}
            className="shrink-0 rounded border border-line-soft px-1.5 py-0.5 font-mono text-[9px] text-fg-mute hover:border-accent/40 hover:text-accent"
            title="Refresh status"
          >
            ↻
          </button>
        </div>
      </div>
    );
  }

  if (stuckQueued) {
    // Non-actionable until a sandbox is available — keep a quiet chip, not spam.
    return (
      <div className="pointer-events-auto absolute right-4 top-4 z-40">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded-full border border-[rgba(212,168,67,0.35)] bg-[rgba(8,10,12,0.92)] px-3 py-1.5 text-left backdrop-blur-md hover:border-warn/50"
          aria-expanded={expanded}
          title="Cloud sandbox provision is queued on the host (needs image + timer)"
        >
          <span className="font-mono text-[9px] uppercase tracking-wider text-fg-mute">
            Cloud VPS
          </span>
          <span className="ml-2 text-[11px] text-warn">Queued</span>
          <span className="ml-2 font-mono text-[9px] text-fg-mute">
            {expanded ? "▴" : "▾"}
          </span>
        </button>
        {expanded && (
          <div className="mt-1.5 w-[min(260px,calc(100vw-2rem))] space-y-2 rounded-xl border border-line-soft bg-[rgba(8,10,12,0.94)] p-2.5 backdrop-blur-md">
            <p className="text-[10px] leading-snug text-fg-mute">
              Sandbox provision is waiting on the host helper (image + timer).
              Orbit agent still works with API tools (HTTP). Shell needs Running.
            </p>
            {cloudStatus.container_name && (
              <p className="truncate font-mono text-[9px] text-fg-mute">
                {cloudStatus.container_name}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void refreshCloudStatus()}
                className="rounded border border-line-soft px-2 py-1 font-mono text-[9px] text-fg-mute hover:border-accent/40 hover:text-accent"
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={cloudBusy}
                onClick={() => void ensureCloud()}
                className="rounded border border-line px-2 py-1 font-mono text-[9px] text-fg-dim hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                {cloudBusy ? "Requesting…" : "Ensure sandbox"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Idle / stopped / brief pending
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-40 max-w-[280px]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full rounded-xl border border-line-soft bg-[rgba(8,10,12,0.9)] px-3 py-2.5 text-left backdrop-blur-md hover:border-accent/30"
        aria-expanded={expanded}
      >
        <p className="font-mono text-[9px] uppercase tracking-wider text-fg-mute">
          Cloud VPS
        </p>
        <p className="mt-0.5 text-[12px] text-fg-dim">
          {isPending
            ? `Starting… · ${status}`
            : status === "stopped"
              ? "Stopped — start sandbox for Cloud tools"
              : "Not running — Ensure sandbox for Cloud tools"}
          {isPending && (
            <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn align-middle" />
          )}
        </p>
        <span className="mt-1 block font-mono text-[9px] text-fg-mute">
          {expanded ? "Hide ▴" : "Manage ▾"}
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-2 rounded-xl border border-line-soft bg-[rgba(8,10,12,0.94)] p-2.5 backdrop-blur-md">
          <p className="text-[10px] leading-relaxed text-fg-mute">
            Your Cloud plan includes a per-user sandbox container. Start it so
            Play and agent tools can run real work (same idea as IDE Cloud).
          </p>
          {message && (
            <p className="text-[10px] leading-snug text-fg-mute">{message}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void refreshCloudStatus()}
              className="rounded border border-line-soft px-2 py-1 font-mono text-[9px] text-fg-mute hover:border-accent/40 hover:text-accent"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={cloudBusy}
              onClick={() => void ensureCloud()}
              className="rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[9px] text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {cloudBusy ? "Requesting…" : "Ensure sandbox"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
