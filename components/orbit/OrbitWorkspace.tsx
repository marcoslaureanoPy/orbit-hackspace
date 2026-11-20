"use client";

import { useEffect, useRef, type DragEvent } from "react";
import { OrbitBubble } from "./OrbitBubble";
import { OrbitCloudStatus } from "./OrbitCloudStatus";
import { OrbitCredentials } from "./OrbitCredentials";
import { ORBIT_DRAG_MIME, ORBIT_PARENT_MIME, OrbitCore } from "./OrbitCore";
import { spokePath } from "./physics";
import {
  OrbitProvider,
  useOrbitStore,
  type OrbitMode,
} from "./useOrbitStore";

function OrbitCanvas() {
  const {
    ready,
    bubbles,
    setViewport,
    viewport,
    ejectToOrbit,
    coreShape,
    mode,
    chatMode,
    authenticated,
    streaming,
  } = useOrbitStore();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewport(r.width, r.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  const cx = viewport.w / 2;
  const cy = viewport.h / 2;

  function onDragOver(e: DragEvent) {
    if (
      e.dataTransfer.types.includes(ORBIT_DRAG_MIME) ||
      e.dataTransfer.types.includes("text/plain")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const id =
      e.dataTransfer.getData(ORBIT_DRAG_MIME) ||
      e.dataTransfer.getData("text/plain");
    if (!id || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const parentBubbleId = e.dataTransfer.getData(ORBIT_PARENT_MIME) || undefined;
    ejectToOrbit(id, { x, y, shape: "card", parentBubbleId });
  }

  if (!ready) {
    return (
      <div
        ref={rootRef}
        className="orbit-workspace relative flex h-full w-full items-center justify-center"
      >
        <p className="font-mono text-xs text-fg-mute">Initializing Orbit…</p>
      </div>
    );
  }

  const modeLabel =
    mode === "demo"
      ? "Demo · local mock"
      : chatMode === "live" && authenticated
        ? streaming
          ? "Live · NanoGrav streaming"
          : "Live · NanoGrav API"
        : "Workspace · mock fallback";

  return (
    <div
      ref={rootRef}
      className="orbit-workspace relative h-full w-full overflow-hidden"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(circle, rgba(61,207,176,0.14) 0%, rgba(61,207,176,0.04) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="orbit-ring pointer-events-none absolute left-1/2 top-1/2 z-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(61,207,176,0.08)]"
        aria-hidden
      />
      <div
        className="orbit-ring-slow pointer-events-none absolute left-1/2 top-1/2 z-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgba(61,207,176,0.12)]"
        aria-hidden
      />

      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
        <span className="rounded-full border border-[rgba(61,207,176,0.35)] bg-[rgba(8,10,12,0.85)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-accent backdrop-blur-sm">
          {modeLabel}
        </span>
      </div>

      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="orbitSpoke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(61,207,176,0.45)" />
            <stop offset="100%" stopColor="rgba(61,207,176,0.08)" />
          </linearGradient>
        </defs>
        {bubbles.map((b) => (
          <path
            key={`spoke-${b.id}`}
            d={spokePath(cx, cy, b.x, b.y, b.w, b.h)}
            stroke="url(#orbitSpoke)"
            strokeWidth={1.25}
            fill="none"
            className="orbit-spoke"
          />
        ))}
      </svg>

      <div
        className={`absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 ${
          coreShape === "round"
            ? "h-[min(520px,72vmin)] w-[min(520px,72vmin)]"
            : "h-[min(640px,82%)] w-[min(440px,92%)]"
        }`}
      >
        <OrbitCore />
      </div>

      {bubbles.map((b) => (
        <OrbitBubble key={b.id} bubble={b} />
      ))}

      <OrbitCredentials />
      {mode === "live" && <OrbitCloudStatus />}

      {bubbles.length === 0 && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-lg -translate-x-1/2 text-center text-[11px] leading-relaxed text-fg-mute">
          Drag a finding out, or select and{" "}
          <span className="text-accent">Eject to orbit</span>. Run{" "}
          <span className="text-accent">Play</span>, then{" "}
          <span className="text-accent">Pull to core</span>. Confused by an old
          thread? Use <span className="text-warn">Reset chat</span> in the core
          header.
        </p>
      )}
    </div>
  );
}

export function OrbitWorkspace({ mode = "demo" }: { mode?: OrbitMode }) {
  return (
    <OrbitProvider mode={mode}>
      <OrbitCanvas />
    </OrbitProvider>
  );
}
