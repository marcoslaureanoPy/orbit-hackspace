"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { clamp } from "./physics";
import {
  useOrbitStore,
  type OrbitBubbleState,
} from "./useOrbitStore";

type Props = {
  bubble: OrbitBubbleState;
};

const STATUS_LABEL: Record<OrbitBubbleState["status"], string> = {
  idle: "Idle",
  running: "Running",
  done: "Done",
};

function SizeControls({
  onShrink,
  onGrow,
  compact,
}: {
  onShrink: () => void;
  onGrow: () => void;
  compact?: boolean;
}) {
  const btn =
    compact
      ? "flex h-5 w-5 items-center justify-center rounded-full border border-line-soft text-[10px] text-fg-mute hover:border-accent/40 hover:text-accent"
      : "flex h-6 w-6 items-center justify-center rounded border border-line-soft text-[11px] text-fg-mute hover:border-accent/40 hover:text-accent";
  return (
    <div className="flex items-center gap-0.5" title="Resize bubble">
      <button
        type="button"
        onClick={onShrink}
        className={btn}
        aria-label="Reduce size"
      >
        −
      </button>
      <button
        type="button"
        onClick={onGrow}
        className={btn}
        aria-label="Expand size"
      >
        +
      </button>
    </div>
  );
}

function ResizeHandle({
  onResizeStart,
  round,
}: {
  onResizeStart: (e: ReactPointerEvent) => void;
  round?: boolean;
}) {
  return (
    <div
      className={`absolute z-10 cursor-nwse-resize touch-none ${
        round
          ? "bottom-2 right-[18%] h-4 w-4"
          : "bottom-1 right-1 h-4 w-4"
      }`}
      onPointerDown={onResizeStart}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize bubble"
      title="Drag to resize"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-full w-full text-fg-mute opacity-70 hover:text-accent hover:opacity-100"
        aria-hidden
      >
        <path
          d="M10 14h4v-4M6 14h2M14 6v2M9 9l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BubbleChat({
  bubble,
  compact,
}: {
  bubble: OrbitBubbleState;
  compact?: boolean;
}) {
  const { sendBubbleMessage } = useOrbitStore();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const running = bubble.status === "running";
  const msgs = bubble.messages ?? [];

  useEffect(() => {
    if (!stickRef.current || !scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [msgs, running]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 32;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    sendBubbleMessage(bubble.id, draft);
    setDraft("");
  }

  const bodyText = compact ? "text-[9px]" : "text-[11px]";
  const labelText = compact ? "text-[8px]" : "text-[9px]";
  const excerpt =
    bubble.sourceContent.length > 90
      ? `${bubble.sourceContent.slice(0, 90).trim()}…`
      : bubble.sourceContent;

  return (
    <>
      {excerpt.trim() ? (
        <p className={`shrink-0 font-mono leading-snug text-fg-mute ${labelText}`}>
          {excerpt}
        </p>
      ) : null}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto"
      >
        {msgs.map((m) => {
          const isUser = m.role === "user";
          const isSystem = m.role === "system";
          return (
            <div
              key={m.id}
              className={`rounded-md border px-1.5 py-1 ${
                isSystem
                  ? "border-transparent bg-transparent"
                  : "border-line-soft/60 bg-bg/40"
              }`}
            >
              <div
                className={`mb-0.5 font-mono uppercase tracking-wider ${labelText} ${
                  isUser
                    ? "text-cyan"
                    : isSystem
                      ? "text-fg-mute"
                      : "text-accent/80"
                }`}
              >
                {isSystem ? "context" : m.role}
              </div>
              <p
                className={`whitespace-pre-wrap leading-relaxed ${bodyText} ${
                  isSystem ? "text-fg-mute" : "text-fg-dim"
                }`}
              >
                {m.content || (running && m.role === "assistant" ? "…" : "")}
              </p>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={submit}
        className="shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the sub-agent…"
            disabled={running}
            className={`min-w-0 flex-1 rounded-full border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-accent/40 focus:outline-none disabled:opacity-50 ${
              compact ? "text-[10px]" : "text-[12px]"
            }`}
            aria-label="Message the sub-agent"
          />
          <button
            type="submit"
            disabled={running || !draft.trim()}
            className={`shrink-0 rounded-full border border-accent/40 bg-accent/15 font-medium text-accent hover:bg-accent/25 disabled:opacity-50 ${
              compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1 text-[11px]"
            }`}
          >
            {running ? "…" : "Send"}
          </button>
        </div>
      </form>
    </>
  );
}

export function OrbitBubble({ bubble }: Props) {
  const {
    updateBubble,
    setBubbleShape,
    resizeBubble,
    nudgeBubbleSize,
    playBubble,
    pullToCore,
    dismissBubble,
    viewport,
    saveToCredentials,
  } = useOrbitStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
  } | null>(null);
  const resizing = useRef<{
    ow: number;
    oh: number;
    sx: number;
    sy: number;
  } | null>(null);

  const shape = bubble.shape ?? "card";
  const size = { w: bubble.w, h: bubble.h };

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("textarea, input, button, a, form, [role='separator']"))
        return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        ox: bubble.x,
        oy: bubble.y,
        sx: e.clientX,
        sy: e.clientY,
      };
    },
    [bubble.x, bubble.y],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (resizing.current) {
        const dx = e.clientX - resizing.current.sx;
        const dy = e.clientY - resizing.current.sy;
        if (shape === "round") {
          const delta = Math.round((dx + dy) / 2);
          resizeBubble(
            bubble.id,
            resizing.current.ow + delta,
            resizing.current.oh + delta,
          );
        } else {
          resizeBubble(
            bubble.id,
            resizing.current.ow + dx,
            resizing.current.oh + dy,
          );
        }
        return;
      }
      if (!drag.current) return;
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      const maxX = Math.max(0, viewport.w - size.w);
      const maxY = Math.max(0, viewport.h - size.h);
      updateBubble(bubble.id, {
        x: clamp(drag.current.ox + dx, 0, maxX),
        y: clamp(drag.current.oy + dy, 0, maxY),
      });
    },
    [
      bubble.id,
      resizeBubble,
      shape,
      size.h,
      size.w,
      updateBubble,
      viewport.h,
      viewport.w,
    ],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    if (drag.current || resizing.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    drag.current = null;
    resizing.current = null;
  }, []);

  const onResizeStart = useCallback(
    (e: ReactPointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      rootRef.current?.setPointerCapture(e.pointerId);
      resizing.current = {
        ow: bubble.w,
        oh: bubble.h,
        sx: e.clientX,
        sy: e.clientY,
      };
    },
    [bubble.h, bubble.w],
  );

  const statusColor =
    bubble.status === "running"
      ? "text-warn"
      : bubble.status === "done"
        ? "text-accent"
        : "text-fg-mute";

  const toggleShape = () => {
    setBubbleShape(bubble.id, shape === "round" ? "card" : "round");
  };

  if (shape === "round") {
    return (
      <div
        ref={rootRef}
        className="orbit-bubble orbit-bubble-round absolute z-30 flex flex-col overflow-hidden border border-[rgba(61,207,176,0.4)] bg-[rgba(8,10,12,0.94)] shadow-[0_0_40px_rgba(61,207,176,0.16),0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
        style={{
          left: bubble.x,
          top: bubble.y,
          width: size.w,
          height: size.h,
          borderRadius: "50%",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Safe inner circle padding from curved edge */}
        <div className="orbit-bubble-handle flex cursor-grab flex-col items-center px-[14%] pt-[12%] pb-1 active:cursor-grabbing">
          <div className="flex w-full items-start justify-between gap-1">
            <button
              type="button"
              onClick={toggleShape}
              className="shrink-0 rounded-full border border-line-soft px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-fg-mute hover:border-accent/40 hover:text-accent"
              title="Switch to card"
              aria-label="Switch to card shape"
            >
              Card
            </button>
            <SizeControls
              compact
              onShrink={() => nudgeBubbleSize(bubble.id, -24)}
              onGrow={() => nudgeBubbleSize(bubble.id, 24)}
            />
            <button
              type="button"
              onClick={() => dismissBubble(bubble.id)}
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] text-fg-mute hover:bg-line-soft hover:text-fg-dim"
              aria-label="Archive bubble"
              title="Archive"
            >
              ✕
            </button>
          </div>
          <input
            value={bubble.title}
            onChange={(e) => updateBubble(bubble.id, { title: e.target.value })}
            className="mt-1 w-full bg-transparent text-center text-[11px] font-medium text-fg outline-none placeholder:text-fg-mute"
            aria-label="Bubble title"
          />
          <span
            className={`font-mono text-[8px] uppercase tracking-wider ${statusColor}`}
          >
            {STATUS_LABEL[bubble.status]}
            {bubble.status === "running" && (
              <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn align-middle" />
            )}
          </span>
        </div>

        <div className="orbit-bubble-round-body mx-[12%] mb-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-1">
          <BubbleChat bubble={bubble} compact />
        </div>

        <div className="flex shrink-0 flex-wrap justify-center gap-1 px-[14%] pb-[11%] pt-1">
          <button
            type="button"
            disabled={bubble.status === "running"}
            onClick={() => playBubble(bubble.id)}
            className="flex items-center justify-center gap-0.5 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-medium text-[#04110e] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden>▶</span>
            Play
          </button>
          <button
            type="button"
            onClick={() => pullToCore(bubble.id)}
            className="flex items-center justify-center gap-0.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <span aria-hidden>↙</span>
            Pull
          </button>
          <button
            type="button"
            onClick={() =>
              saveToCredentials(
                [bubble.title, bubble.sourceContent, bubble.notes]
                  .filter(Boolean)
                  .join("\n"),
              )
            }
            className="flex items-center justify-center rounded-full border border-line-soft px-2 py-1 text-[9px] font-medium text-fg-mute hover:border-accent/40 hover:text-accent"
            title="Save to credentials"
          >
            Creds
          </button>
        </div>

        <ResizeHandle round onResizeStart={onResizeStart} />
      </div>
    );
  }

  // Card layout — true rectangle (rounded-xl only, NEVER border-radius 50%)
  return (
    <div
      ref={rootRef}
      className="orbit-bubble orbit-bubble-card absolute z-30 flex flex-col overflow-hidden rounded-xl border border-[rgba(61,207,176,0.35)] bg-[rgba(8,10,12,0.94)] shadow-[0_0_40px_rgba(61,207,176,0.12),0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
      style={{
        left: bubble.x,
        top: bubble.y,
        width: size.w,
        height: size.h,
        borderRadius: 12,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-shape="card"
    >
      <div className="orbit-bubble-handle flex shrink-0 cursor-grab items-start gap-2 border-b border-line px-3 py-2 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <input
            value={bubble.title}
            onChange={(e) => updateBubble(bubble.id, { title: e.target.value })}
            className="w-full bg-transparent text-[12px] font-medium text-fg outline-none placeholder:text-fg-mute"
            aria-label="Bubble title"
          />
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={`font-mono text-[9px] uppercase tracking-wider ${statusColor}`}
            >
              {STATUS_LABEL[bubble.status]}
              {bubble.status === "running" && (
                <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn align-middle" />
              )}
            </span>
            <span className="font-mono text-[8px] uppercase tracking-wider text-accent/70">
              Card
            </span>
          </div>
        </div>
        <SizeControls
          onShrink={() => nudgeBubbleSize(bubble.id, -28)}
          onGrow={() => nudgeBubbleSize(bubble.id, 28)}
        />
        <button
          type="button"
          onClick={toggleShape}
          className="shrink-0 rounded border border-line-soft px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-mute hover:border-accent/40 hover:text-accent"
          title="Switch to round"
          aria-label="Switch to round shape"
        >
          Round
        </button>
        <button
          type="button"
          onClick={() => dismissBubble(bubble.id)}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-fg-mute hover:bg-line-soft hover:text-fg-dim"
          aria-label="Archive bubble"
          title="Archive"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 py-2">
        <BubbleChat bubble={bubble} />
      </div>

      <div className="flex shrink-0 gap-1.5 border-t border-line px-2 py-2 pr-6">
        <button
          type="button"
          disabled={bubble.status === "running"}
          onClick={() => playBubble(bubble.id)}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent/90 px-2 py-1.5 text-[11px] font-medium text-[#04110e] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>▶</span>
          Play
        </button>
        <button
          type="button"
          onClick={() => pullToCore(bubble.id)}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <span aria-hidden>↙</span>
          Pull
        </button>
        <button
          type="button"
          onClick={() =>
            saveToCredentials(
              [bubble.title, bubble.sourceContent, bubble.notes]
                .filter(Boolean)
                .join("\n"),
            )
          }
          className="flex items-center justify-center rounded-md border border-line-soft px-2 py-1.5 text-[10px] font-medium text-fg-mute hover:border-accent/40 hover:text-accent"
          title="Save to credentials"
        >
          Creds
        </button>
      </div>

      <ResizeHandle onResizeStart={onResizeStart} />
    </div>
  );
}
