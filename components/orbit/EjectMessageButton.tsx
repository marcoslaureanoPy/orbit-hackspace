"use client";

import type { MouseEvent, PointerEvent } from "react";

/** Per-message action: spawn a sub-agent bubble from this turn. */
export function EjectMessageButton({
  onEject,
  compact,
}: {
  onEject: () => void;
  compact?: boolean;
}) {
  function stop(e: MouseEvent | PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <button
      type="button"
      onPointerDown={stop}
      onClick={(e) => {
        stop(e);
        onEject();
      }}
      className={`shrink-0 rounded-full border border-accent/40 bg-accent/10 font-medium text-accent transition-colors hover:bg-accent/20 ${
        compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      }`}
      title="Sacar burbuja — continue this part in its own session, with the parent work context"
      aria-label="Sacar burbuja"
    >
      ↗ Eject
    </button>
  );
}
