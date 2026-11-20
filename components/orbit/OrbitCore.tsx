"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useOrbitStore } from "./useOrbitStore";

export const ORBIT_DRAG_MIME = "application/x-orbit-message-id";

export function OrbitCore() {
  const {
    messages,
    selectedMessageId,
    selectMessage,
    ejectToOrbit,
    appendUserMessage,
    resetWorkspace,
    coreShape,
    setCoreShape,
    saveToCredentials,
    streaming,
    chatMode,
  } = useOrbitStore();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const isRound = coreShape === "round";

  useEffect(() => {
    if (!stickRef.current || !scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 48;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    appendUserMessage(draft);
    setDraft("");
  }

  function onMsgDragStart(e: DragEvent, messageId: string) {
    e.dataTransfer.setData(ORBIT_DRAG_MIME, messageId);
    e.dataTransfer.setData("text/plain", messageId);
    e.dataTransfer.effectAllowed = "copy";
  }

  function toggleShape() {
    setCoreShape(isRound ? "card" : "round");
  }

  const headerPad = isRound
    ? "flex shrink-0 items-center justify-between gap-2 px-[18%] pb-1 pt-[14%]"
    : "flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3";
  const hintPad = isRound
    ? "shrink-0 px-[20%] pb-1 text-center font-mono text-[9px] text-fg-mute"
    : "shrink-0 px-4 pb-1 text-center font-mono text-[9px] text-fg-mute";
  const scrollPad = isRound
    ? "orbit-core-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-[16%] py-2"
    : "orbit-core-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2";
  const ejectPad = isRound ? "shrink-0 px-[18%] py-1.5" : "shrink-0 px-4 py-1.5";
  const formPad = isRound
    ? "shrink-0 px-[16%] pb-[12%] pt-1"
    : "shrink-0 px-4 pb-3 pt-1";

  return (
    <div
      className={`orbit-core relative z-20 flex h-full w-full flex-col overflow-hidden border border-[rgba(61,207,176,0.28)] bg-[rgba(10,12,14,0.92)] shadow-[0_0_0_1px_rgba(61,207,176,0.08),0_0_60px_rgba(61,207,176,0.1),0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md ${
        isRound ? "orbit-core-round" : "orbit-core-card rounded-2xl"
      }`}
      style={isRound ? { borderRadius: "50%" } : undefined}
    >
      {/* Header */}
      <div className={headerPad}>
        <div className="min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <h1 className="truncate text-sm font-medium tracking-wide text-fg">
              Orbit Core
            </h1>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-fg-mute">
            Main agent ·{" "}
            {chatMode === "live"
              ? streaming
                ? "agent tools…"
                : "NanoGrav agent"
              : "mock stream"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleShape}
            className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-fg-mute transition-colors hover:border-accent/40 hover:text-accent"
            title={isRound ? "Switch to card" : "Switch to round"}
            aria-label={isRound ? "Switch to card shape" : "Switch to round shape"}
          >
            {isRound ? "Card" : "Round"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Clear Orbit chat and bubbles? Credentials vault is kept.",
                )
              ) {
                return;
              }
              resetWorkspace();
            }}
            className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-warn transition-colors hover:border-warn/60 hover:bg-warn/20"
            title="Clear chat and bubbles (keeps credentials)"
          >
            Reset chat
          </button>
        </div>
      </div>

      <p className={hintPad}>
        Drag a finding out, or select and Eject
      </p>

      {/* Scrollable messages */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className={scrollPad}
      >
        {messages.length <= 1 && (
          <p className="rounded-lg border border-dashed border-line-soft px-2.5 py-2 text-center font-mono text-[10px] leading-relaxed text-fg-mute">
            Clean workspace. Message the core to start — or tap{" "}
            <span className="text-warn">Reset chat</span> anytime to wipe old
            threads.
          </p>
        )}
        {messages.map((m) => {
          const selected = selectedMessageId === m.id;
          const isUser = m.role === "user";
          const isMerge = m.role === "merge";
          const isSystem = m.role === "system";
          return (
            <button
              key={m.id}
              type="button"
              draggable
              onDragStart={(e) => onMsgDragStart(e, m.id)}
              onClick={() => selectMessage(selected ? null : m.id)}
              className={`group w-full cursor-grab rounded-lg border px-2.5 py-1.5 text-left transition-all active:cursor-grabbing ${
                selected
                  ? "border-accent/50 bg-accent/10 shadow-[0_0_24px_rgba(61,207,176,0.12)]"
                  : isMerge
                    ? "border-accent/25 bg-[rgba(61,207,176,0.06)] hover:border-accent/40"
                    : isSystem
                      ? "border-transparent bg-transparent hover:border-line"
                      : "border-line-soft bg-bg/40 hover:border-line"
              }`}
            >
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-[9px] uppercase tracking-wider ${
                    isUser
                      ? "text-cyan"
                      : isMerge
                        ? "text-accent"
                        : isSystem
                          ? "text-fg-mute"
                          : "text-accent/80"
                  }`}
                >
                  {isMerge ? "merge" : m.role}
                </span>
                {selected && (
                  <span className="text-[9px] text-accent">selected</span>
                )}
              </div>
              <p
                className={`whitespace-pre-wrap text-[11px] leading-relaxed ${
                  isSystem ? "text-fg-mute" : "text-fg-dim"
                }`}
              >
                {m.content}
              </p>
            </button>
          );
        })}
      </div>

      {selectedMessageId && (
        <div className={`${ejectPad} space-y-1.5`}>
          <button
            type="button"
            onClick={() => ejectToOrbit()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-3 py-2 text-xs font-medium text-[#04110e] transition-opacity hover:opacity-90"
          >
            <span aria-hidden>↗</span>
            Eject to orbit
          </button>
          <button
            type="button"
            onClick={() => {
              const msg = messages.find((m) => m.id === selectedMessageId);
              if (msg) saveToCredentials(msg.content);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Save to credentials
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={submit} className={formPad}>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the core…"
            className="min-w-0 flex-1 rounded-full border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-mute focus:border-accent/40 focus:outline-none"
            aria-label="Message the core"
          />
          <button
            type="submit"
            disabled={streaming}
            className="shrink-0 rounded-full border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
