"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BUBBLE_H,
  BUBBLE_W,
  ROUND_D_MAX,
  ROUND_D_MIN,
  bubbleSize,
  clamp,
  nextRingSlot,
  type BubbleShape,
} from "./physics";
import { SEED_MESSAGES, STREAM_APPEND, SUBAGENT_STEPS } from "./seed";
import {
  checkOrbitAuth,
  createOrbitCredential,
  ensureCloudSandbox,
  fetchCloudStatus,
  fetchOrbitCredentials,
  streamOrbitAgent,
  syncOrbitCredentials,
  type CloudStatusDto,
} from "@/lib/orbit/api";
import { parseCredentialFromText } from "@/lib/orbit/parseCredentials";
import {
  buildEjectedSeed,
  excerptOf,
  parentLabel as formatParentLabel,
  selectBubbleSendHistory,
} from "@/lib/orbit/ejectSeed";

/** Separate namespaces so demo mock history never pollutes /orbit/app. */
const STORAGE_KEY_DEMO = "ng_orbit_demo_v6";
const STORAGE_KEY_APP = "ng_orbit_app_v6";
const CREDS_KEY_DEMO = "ng_orbit_demo_creds_v1";
const CREDS_KEY_APP = "ng_orbit_app_creds_v1";
/** Legacy shared keys (pre-split) — demo may migrate once; live never inherits them. */
const LEGACY_STORAGE_KEYS = [
  "ng_orbit_v5",
  "ng_orbit_v4",
  "ng_orbit_v3",
  "ng_orbit_v2",
];
const LEGACY_CREDS_KEY = "ng_orbit_creds_v1";

export type OrbitMode = "demo" | "live";

function storageKeyFor(mode: OrbitMode): string {
  return mode === "live" ? STORAGE_KEY_APP : STORAGE_KEY_DEMO;
}

function credsKeyFor(mode: OrbitMode): string {
  return mode === "live" ? CREDS_KEY_APP : CREDS_KEY_DEMO;
}

/** Card size clamps */
export const CARD_W_MIN = 240;
export const CARD_W_MAX = 480;
export const CARD_H_MIN = 200;
export const CARD_H_MAX = 520;

/** Round diameter clamps (aligned with physics bounds) */
export const ROUND_SIZE_MIN = ROUND_D_MIN;
export const ROUND_SIZE_MAX = ROUND_D_MAX + 40;

export type CoreMessage = {
  id: string;
  role: "assistant" | "user" | "system" | "merge";
  content: string;
  createdAt: number;
};

export type BubbleStatus = "idle" | "running" | "done";

export type OrbitBubbleState = {
  id: string;
  title: string;
  notes: string;
  sourceMessageId: string;
  sourceContent: string;
  /** null = ejected from the core chat; otherwise the parent bubble id. */
  parentId: string | null;
  /** "Core" or the parent bubble title at eject time. */
  parentTitle: string;
  sourceRole: CoreMessage["role"];
  /** Short preview of the chosen source message, shown in the bubble header. */
  sourceExcerpt: string;
  status: BubbleStatus;
  subagentLog: string[];
  /** Sub-agent conversation in this bubble (separate from the core chat). */
  messages: CoreMessage[];
  x: number;
  y: number;
  createdAt: number;
  shape: BubbleShape;
  /** Explicit width (card) or diameter (round). Persisted. */
  w: number;
  /** Explicit height (card) or diameter (round). Persisted. */
  h: number;
};

export type OrbitCredential = {
  id: string;
  resource: string;
  secret: string;
  usage: string;
};

type Persisted = {
  v: 5;
  messages: CoreMessage[];
  bubbles: OrbitBubbleState[];
  streamIndex: number;
  coreShape: BubbleShape;
};

type EjectOpts = {
  x?: number;
  y?: number;
  shape?: BubbleShape;
  /** When set, eject a message from this bubble's chat instead of the core. */
  parentBubbleId?: string;
};

type OrbitStore = {
  ready: boolean;
  messages: CoreMessage[];
  bubbles: OrbitBubbleState[];
  selectedMessageId: string | null;
  viewport: { w: number; h: number };
  credentials: OrbitCredential[];
  coreShape: BubbleShape;
  setCoreShape: (shape: BubbleShape) => void;
  setViewport: (w: number, h: number) => void;
  selectMessage: (id: string | null) => void;
  ejectToOrbit: (messageId?: string, opts?: EjectOpts) => void;
  updateBubble: (
    id: string,
    patch: Partial<
      Pick<OrbitBubbleState, "title" | "notes" | "x" | "y" | "shape" | "w" | "h">
    >,
  ) => void;
  setBubbleShape: (id: string, shape: BubbleShape) => void;
  resizeBubble: (id: string, w: number, h: number) => void;
  nudgeBubbleSize: (id: string, delta: number) => void;
  playBubble: (id: string) => void;
  /** Send a normal chat turn in a bubble's own sub-agent session. */
  sendBubbleMessage: (id: string, content: string) => void;
  /** Pull this bubble's work back into its parent (core or parent bubble). */
  pullToCore: (id: string) => void;
  dismissBubble: (id: string) => void;
  appendUserMessage: (content: string) => void;
  resetWorkspace: () => void;
  addCredential: (draft?: Partial<Pick<OrbitCredential, "resource" | "secret" | "usage">>) => void;
  updateCredential: (
    id: string,
    patch: Partial<Pick<OrbitCredential, "resource" | "secret" | "usage">>,
  ) => void;
  removeCredential: (id: string) => void;
  /** Parse text → open vault with prefilled Resource/Secret/Usage */
  saveToCredentials: (text: string) => void;
  credentialsOpen: boolean;
  setCredentialsOpen: (open: boolean) => void;
  mode: OrbitMode;
  authenticated: boolean;
  chatMode: "mock" | "live";
  cloudStatus: CloudStatusDto | null;
  cloudBusy: boolean;
  refreshCloudStatus: () => Promise<void>;
  ensureCloud: () => Promise<void>;
  streaming: boolean;
};

const OrbitCtx = createContext<OrbitStore | null>(null);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/** Stable OpenClaw conversation id for one bubble, separate from the core session. */
export function bubbleSessionUser(bubbleId: string) {
  return `conv:orbit-bubble-${bubbleId}`;
}

function migrateMessages(raw: unknown): CoreMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CoreMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Partial<CoreMessage>;
    if (typeof m.id !== "string" || typeof m.content !== "string") continue;
    if (
      m.role !== "user" &&
      m.role !== "assistant" &&
      m.role !== "system" &&
      m.role !== "merge"
    ) {
      continue;
    }
    out.push({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
    });
  }
  return out;
}

function seedDemoMessages(): CoreMessage[] {
  const t0 = Date.now() - SEED_MESSAGES.length * 4000;
  return SEED_MESSAGES.map((m, i) => ({
    id: uid("msg"),
    role: m.role,
    content: m.content,
    createdAt: t0 + i * 4000,
  }));
}

/** Clean live workspace — no mock pentest narrative. */
function liveWelcomeMessages(): CoreMessage[] {
  return [
    {
      id: uid("msg"),
      role: "system",
      content:
        "Orbit workspace ready · Live NanoGrav. Describe your authorized scope and goals. Use Reset anytime to clear this chat (vault is kept).",
      createdAt: Date.now(),
    },
  ];
}

function initialMessagesFor(mode: OrbitMode): CoreMessage[] {
  return mode === "live" ? liveWelcomeMessages() : seedDemoMessages();
}

function defaultSizeFor(
  shape: BubbleShape,
  contentLength: number,
): { w: number; h: number } {
  return bubbleSize(shape, contentLength);
}

function clampBubbleSize(
  shape: BubbleShape,
  w: number,
  h: number,
): { w: number; h: number } {
  if (shape === "round") {
    const d = clamp(
      Math.round((w + h) / 2),
      ROUND_SIZE_MIN,
      ROUND_SIZE_MAX,
    );
    return { w: d, h: d };
  }
  return {
    w: clamp(Math.round(w), CARD_W_MIN, CARD_W_MAX),
    h: clamp(Math.round(h), CARD_H_MIN, CARD_H_MAX),
  };
}

function migrateBubble(raw: Partial<OrbitBubbleState>): OrbitBubbleState | null {
  if (!raw || typeof raw.id !== "string") return null;
  const shape: BubbleShape = raw.shape === "round" ? "round" : "card";
  const content =
    typeof raw.sourceContent === "string" ? raw.sourceContent : "";
  const fallback = defaultSizeFor(shape, content.length);
  let w = typeof raw.w === "number" && Number.isFinite(raw.w) ? raw.w : fallback.w;
  let h = typeof raw.h === "number" && Number.isFinite(raw.h) ? raw.h : fallback.h;
  // Legacy: only diameter fields missing — derive from physics
  if (typeof raw.w !== "number" && typeof raw.h !== "number") {
    const s = defaultSizeFor(shape, content.length);
    w = s.w;
    h = s.h;
  }
  const sized = clampBubbleSize(shape, w, h);
  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "Finding",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    sourceMessageId:
      typeof raw.sourceMessageId === "string" ? raw.sourceMessageId : "",
    sourceContent: content,
    parentId: typeof raw.parentId === "string" && raw.parentId ? raw.parentId : null,
    parentTitle:
      typeof raw.parentTitle === "string" && raw.parentTitle.trim()
        ? raw.parentTitle
        : "Core",
    sourceRole:
      raw.sourceRole === "user" ||
      raw.sourceRole === "assistant" ||
      raw.sourceRole === "system" ||
      raw.sourceRole === "merge"
        ? raw.sourceRole
        : "assistant",
    sourceExcerpt:
      typeof raw.sourceExcerpt === "string" && raw.sourceExcerpt.trim()
        ? raw.sourceExcerpt
        : excerptOf(content),
    status:
      raw.status === "running" || raw.status === "done" || raw.status === "idle"
        ? raw.status
        : "idle",
    subagentLog: Array.isArray(raw.subagentLog) ? raw.subagentLog : [],
    messages: (() => {
      const existing = migrateMessages(raw.messages);
      if (existing.length > 0) return existing;
      const title = typeof raw.title === "string" ? raw.title : "Finding";
      const notes = typeof raw.notes === "string" ? raw.notes : "";
      return content
        ? [
            {
              id: uid("msg"),
              role: "system" as const,
              content: [
                "You are an Orbit sub-agent. This conversation stays in this bubble, separate from the core chat.",
                title.trim() ? `Finding title: ${title.trim()}` : null,
                "Source finding:",
                content.trim() || "(empty)",
                notes.trim() ? `Operator notes: ${notes.trim()}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              createdAt: Date.now(),
            },
          ]
        : [];
    })(),
    x: typeof raw.x === "number" ? raw.x : 0,
    y: typeof raw.y === "number" ? raw.y : 0,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    shape,
    w: sized.w,
    h: sized.h,
  };
}

function parsePersistedRaw(raw: string): Persisted | null {
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      messages?: CoreMessage[];
      bubbles?: unknown[];
      streamIndex?: number;
      coreShape?: BubbleShape;
    };
    if (!Array.isArray(parsed.messages)) return null;
    const bubbles = (parsed.bubbles ?? [])
      .map((b) => migrateBubble(b as Partial<OrbitBubbleState>))
      .filter((b): b is OrbitBubbleState => b !== null);
    const coreShape: BubbleShape =
      parsed.coreShape === "card" ? "card" : "round";
    return {
      v: 5,
      messages: parsed.messages,
      bubbles,
      streamIndex: parsed.streamIndex ?? 0,
      coreShape,
    };
  } catch {
    return null;
  }
}

function loadPersisted(mode: OrbitMode): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const key = storageKeyFor(mode);
    const own = localStorage.getItem(key);
    if (own) return parsePersistedRaw(own);

    // Demo only: one-time migrate from legacy shared keys (often demo pollution).
    // Live app must NEVER inherit that old mock chat.
    if (mode === "demo") {
      for (const legacy of LEGACY_STORAGE_KEYS) {
        const raw = localStorage.getItem(legacy);
        if (!raw) continue;
        const parsed = parsePersistedRaw(raw);
        if (parsed) {
          try {
            localStorage.setItem(key, JSON.stringify(parsed));
          } catch {
            /* ignore */
          }
          return parsed;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function savePersisted(mode: OrbitMode, data: Persisted) {
  try {
    localStorage.setItem(storageKeyFor(mode), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function parseCredentialsRaw(raw: string): OrbitCredential[] {
  try {
    const parsed = JSON.parse(raw) as { credentials?: OrbitCredential[] };
    if (!Array.isArray(parsed?.credentials)) return [];
    return parsed.credentials
      .filter((c) => c && typeof c.id === "string")
      .map((c) => ({
        id: c.id,
        resource: typeof c.resource === "string" ? c.resource : "",
        secret: typeof c.secret === "string" ? c.secret : "",
        usage: typeof c.usage === "string" ? c.usage : "",
      }));
  } catch {
    return [];
  }
}

function loadCredentials(mode: OrbitMode): OrbitCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const key = credsKeyFor(mode);
    const own = localStorage.getItem(key);
    if (own) return parseCredentialsRaw(own);
    // Demo may adopt legacy vault once; live keeps its own namespace.
    if (mode === "demo") {
      const legacy = localStorage.getItem(LEGACY_CREDS_KEY);
      if (legacy) {
        const creds = parseCredentialsRaw(legacy);
        if (creds.length > 0) {
          try {
            localStorage.setItem(key, JSON.stringify({ v: 1, credentials: creds }));
          } catch {
            /* ignore */
          }
          return creds;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

function saveCredentials(mode: OrbitMode, credentials: OrbitCredential[]) {
  try {
    localStorage.setItem(
      credsKeyFor(mode),
      JSON.stringify({ v: 1, credentials }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Compact vault context for the model.
 * Live: send resource + usage + secret-present flag (not full secrets) to keep payloads small.
 * Demo mock: may include secrets since everything is local.
 */
export function buildCredentialsContext(
  credentials: OrbitCredential[],
  opts?: { includeSecrets?: boolean },
): string {
  const includeSecrets = opts?.includeSecrets === true;
  const usable = credentials.filter(
    (c) => c.resource.trim() || c.secret.trim() || c.usage.trim(),
  );
  if (usable.length === 0) return "";
  const lines = usable.slice(0, 12).map((c, i) => {
    const resource = c.resource.trim() || `(resource ${i + 1})`;
    const usage = (c.usage.trim() || "general").slice(0, 120);
    const secret = c.secret.trim();
    if (includeSecrets && secret) {
      return `  · ${resource} | usage: ${usage} | key: ${secret.slice(0, 200)}`;
    }
    return `  · ${resource} | usage: ${usage}${secret ? " | key: (stored — ask operator if needed)" : ""}`;
  });
  return `Available credentials:\n${lines.join("\n")}`;
}

/** Safe for UI logs — secrets masked. */
export function buildCredentialsLogLine(
  credentials: OrbitCredential[],
): string {
  const usable = credentials.filter(
    (c) => c.resource.trim() || c.secret.trim() || c.usage.trim(),
  );
  if (usable.length === 0) return "Credentials: (none stored)";
  const parts = usable.map((c) => {
    const resource = c.resource.trim() || "resource";
    const usage = c.usage.trim() || "—";
    const hasKey = c.secret.trim().length > 0;
    return `${resource} (${usage}${hasKey ? ", key:••••" : ""})`;
  });
  return `Credentials context: ${parts.join("; ")}`;
}

export function OrbitProvider({
  children,
  mode = "demo",
}: {
  children: ReactNode;
  mode?: OrbitMode;
}) {
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [bubbles, setBubbles] = useState<OrbitBubbleState[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [viewport, setViewportState] = useState({ w: 1200, h: 800 });
  const [credentials, setCredentials] = useState<OrbitCredential[]>([]);
  const [coreShape, setCoreShapeState] = useState<BubbleShape>("round");
  // Live starts collapsed to reduce clutter; demo can stay open for discovery.
  const [credentialsOpen, setCredentialsOpen] = useState(mode !== "live");
  const [authenticated, setAuthenticated] = useState(false);
  const [chatMode, setChatMode] = useState<"mock" | "live">(
    mode === "live" ? "live" : "mock",
  );
  const [cloudStatus, setCloudStatus] = useState<CloudStatusDto | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamIndexRef = useRef(0);
  const syncCredsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<CoreMessage[]>([]);
  const bubblesRef = useRef<OrbitBubbleState[]>([]);
  const bubbleAbortRef = useRef<Map<string, AbortController>>(new Map());
  const modeRef = useRef<OrbitMode>(mode);
  modeRef.current = mode;
  const chatModeRef = useRef<"mock" | "live">(mode === "live" ? "live" : "mock");
  chatModeRef.current = chatMode;
  const subagentTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const credentialsRef = useRef<OrbitCredential[]>([]);

  useEffect(() => {
    credentialsRef.current = credentials;
  }, [credentials]);

  useEffect(() => {
    messagesRef.current = messages;
    bubblesRef.current = bubbles;
  }, [messages]);

  useEffect(() => {
    setReady(false);
    const persisted = loadPersisted(mode);
    if (persisted && persisted.messages.length > 0) {
      setMessages(persisted.messages);
      setBubbles(persisted.bubbles ?? []);
      streamIndexRef.current = persisted.streamIndex ?? 0;
      setCoreShapeState(persisted.coreShape ?? "round");
    } else {
      setMessages(initialMessagesFor(mode));
      setBubbles([]);
      streamIndexRef.current = 0;
      setCoreShapeState("round");
    }
    setCredentials(loadCredentials(mode));
    setCredentialsOpen(mode !== "live");
    setReady(true);

    if (mode === "live") {
      // Optimistic live until auth resolves — never run demo mock stream in app.
      setChatMode("live");
      void (async () => {
        const ok = await checkOrbitAuth();
        setAuthenticated(ok);
        setChatMode(ok ? "live" : "mock");
        if (ok) {
          const remote = await fetchOrbitCredentials();
          if (remote && remote.length > 0) {
            setCredentials(
              remote.map((c) => ({
                id: c.id,
                resource: c.resource || "",
                secret: c.secret || "",
                usage: c.usage || "",
              })),
            );
          } else {
            const local = loadCredentials("live");
            if (local.length > 0) {
              const synced = await syncOrbitCredentials(
                local.map((c) => ({
                  resource: c.resource,
                  secret: c.secret,
                  usage: c.usage,
                })),
              );
              if (synced) {
                setCredentials(
                  synced.map((c) => ({
                    id: c.id,
                    resource: c.resource || "",
                    secret: c.secret || "",
                    usage: c.usage || "",
                  })),
                );
              }
            }
          }
          // Optional Cloud VPS sandbox only — not required for Orbit chat.
          const cs = await fetchCloudStatus();
          if (cs) setCloudStatus(cs);
        }
      })();
    } else {
      setAuthenticated(false);
      setChatMode("mock");
    }
  }, [mode]);

  useEffect(() => {
    if (!ready) return;
    savePersisted(mode, {
      v: 5,
      messages,
      bubbles,
      streamIndex: streamIndexRef.current,
      coreShape,
    });
  }, [ready, messages, bubbles, coreShape, mode]);

  useEffect(() => {
    if (!ready) return;
    saveCredentials(mode, credentials);
    if (mode !== "live" || !authenticated) return;
    if (syncCredsTimer.current) clearTimeout(syncCredsTimer.current);
    syncCredsTimer.current = setTimeout(() => {
      void syncOrbitCredentials(
        credentials.map((c) => ({
          resource: c.resource,
          secret: c.secret,
          usage: c.usage,
        })),
      );
    }, 1200);
    return () => {
      if (syncCredsTimer.current) clearTimeout(syncCredsTimer.current);
    };
  }, [ready, credentials, mode, authenticated]);

  // Simulated pentest stream — DEMO ONLY. Never inject into /orbit/app.
  useEffect(() => {
    if (!ready) return;
    if (mode !== "demo") return;
    const iv = setInterval(() => {
      const i = streamIndexRef.current;
      if (i >= STREAM_APPEND.length) return;
      const line = STREAM_APPEND[i];
      streamIndexRef.current = i + 1;
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: line.role,
          content: line.content,
          createdAt: Date.now(),
        },
      ]);
    }, 7800);
    return () => clearInterval(iv);
  }, [ready, mode]);

  useEffect(() => {
    const timers = subagentTimers.current;
    return () => {
      timers.forEach((t) => clearInterval(t));
      timers.clear();
    };
  }, []);

  const setCoreShape = useCallback((shape: BubbleShape) => {
    setCoreShapeState(shape === "card" ? "card" : "round");
  }, []);

  const setViewport = useCallback((w: number, h: number) => {
    setViewportState({ w, h });
  }, []);

  const selectMessage = useCallback((id: string | null) => {
    setSelectedMessageId(id);
  }, []);

  const ejectToOrbit = useCallback(
    (messageId?: string, opts?: EjectOpts) => {
      const id = messageId ?? selectedMessageId;
      if (!id) return;
      // Default eject / drag-drop shape = card (readable)
      const shape: BubbleShape = opts?.shape ?? "card";
      const parentBubbleId = opts?.parentBubbleId;
      setBubbles((prev) => {
        if (prev.some((b) => b.sourceMessageId === id)) return prev;

        let parentMessages: CoreMessage[];
        let parentKind: "core" | "bubble";
        let parentTitleRaw: string;
        let parentId: string | null;

        if (parentBubbleId) {
          const parent = prev.find((b) => b.id === parentBubbleId);
          if (!parent) return prev;
          parentMessages = parent.messages ?? [];
          parentKind = "bubble";
          parentTitleRaw = parent.title;
          parentId = parent.id;
        } else {
          parentMessages = messagesRef.current;
          parentKind = "core";
          parentTitleRaw = "Core";
          parentId = null;
        }

        const seeded = buildEjectedSeed({
          parentMessages,
          chosenId: id,
          parentLabel: formatParentLabel(parentKind, parentTitleRaw),
          newId: () => uid("msg"),
        });
        if (!seeded) return prev;
        const { seedMessages, chosen } = seeded;

        const size = defaultSizeFor(shape, chosen.content.length);
        let x: number;
        let y: number;
        if (
          typeof opts?.x === "number" &&
          typeof opts?.y === "number" &&
          Number.isFinite(opts.x) &&
          Number.isFinite(opts.y)
        ) {
          x = Math.max(0, Math.min(opts.x - size.w / 2, viewport.w - size.w));
          y = Math.max(0, Math.min(opts.y - size.h / 2, viewport.h - size.h));
        } else {
          const cx = viewport.w / 2;
          const cy = viewport.h / 2;
          const slot = nextRingSlot(
            prev.map((b) => ({ x: b.x, y: b.y })),
            cx,
            cy,
            Math.min(
              280,
              Math.max(200, Math.min(viewport.w, viewport.h) * 0.32),
            ),
            size.w,
            size.h,
          );
          x = slot.x;
          y = slot.y;
        }
        const title =
          chosen.content.length > 48
            ? `${chosen.content.slice(0, 48).trim()}…`
            : chosen.content;
        const from = formatParentLabel(parentKind, parentTitleRaw);
        const bubble: OrbitBubbleState = {
          id: uid("bub"),
          title: title.replace(/\s+/g, " "),
          notes: "",
          sourceMessageId: chosen.id,
          sourceContent: chosen.content,
          parentId,
          parentTitle: from,
          sourceRole: chosen.role,
          sourceExcerpt: excerptOf(chosen.content),
          status: "idle",
          subagentLog: [],
          messages: seedMessages,
          x,
          y,
          createdAt: Date.now(),
          shape,
          w: size.w,
          h: size.h,
        };
        return [...prev, bubble];
      });
      setSelectedMessageId(null);
    },
    [selectedMessageId, viewport.h, viewport.w],
  );

  const updateBubble = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<OrbitBubbleState, "title" | "notes" | "x" | "y" | "shape" | "w" | "h">
      >,
    ) => {
      setBubbles((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
    },
    [],
  );

  const setBubbleShape = useCallback(
    (id: string, shape: BubbleShape) => {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          // Preserve approximate size when switching shapes
          let nextW: number;
          let nextH: number;
          if (shape === "round") {
            const d = clamp(
              Math.round((b.w + b.h) / 2),
              ROUND_SIZE_MIN,
              ROUND_SIZE_MAX,
            );
            nextW = d;
            nextH = d;
          } else {
            // Coming from round: use diameter as height baseline, widen to card
            nextW = clamp(
              Math.max(BUBBLE_W, Math.round(b.w * 1.15)),
              CARD_W_MIN,
              CARD_W_MAX,
            );
            nextH = clamp(
              Math.max(BUBBLE_H, b.h),
              CARD_H_MIN,
              CARD_H_MAX,
            );
          }
          const sized = clampBubbleSize(shape, nextW, nextH);
          const next = { ...b, shape, w: sized.w, h: sized.h };
          next.x = Math.max(0, Math.min(b.x, Math.max(0, viewport.w - sized.w)));
          next.y = Math.max(0, Math.min(b.y, Math.max(0, viewport.h - sized.h)));
          return next;
        }),
      );
    },
    [viewport.h, viewport.w],
  );

  const resizeBubble = useCallback(
    (id: string, w: number, h: number) => {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const sized = clampBubbleSize(b.shape, w, h);
          return {
            ...b,
            w: sized.w,
            h: sized.h,
            x: Math.max(0, Math.min(b.x, Math.max(0, viewport.w - sized.w))),
            y: Math.max(0, Math.min(b.y, Math.max(0, viewport.h - sized.h))),
          };
        }),
      );
    },
    [viewport.h, viewport.w],
  );

  const nudgeBubbleSize = useCallback(
    (id: string, delta: number) => {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          if (b.shape === "round") {
            const sized = clampBubbleSize(b.shape, b.w + delta, b.h + delta);
            return {
              ...b,
              w: sized.w,
              h: sized.h,
              x: Math.max(0, Math.min(b.x, Math.max(0, viewport.w - sized.w))),
              y: Math.max(0, Math.min(b.y, Math.max(0, viewport.h - sized.h))),
            };
          }
          const sized = clampBubbleSize(
            b.shape,
            b.w + delta,
            b.h + Math.round(delta * 0.85),
          );
          return {
            ...b,
            w: sized.w,
            h: sized.h,
            x: Math.max(0, Math.min(b.x, Math.max(0, viewport.w - sized.w))),
            y: Math.max(0, Math.min(b.y, Math.max(0, viewport.h - sized.h))),
          };
        }),
      );
    },
    [viewport.h, viewport.w],
  );

  const runMockPlay = useCallback(
    (id: string, credLog: string, credCtx: string) => {
      const existing = subagentTimers.current.get(id);
      if (existing) clearInterval(existing);

      const mockPromptContext = credCtx
        ? `You have access to the operator credentials vault.\n${credCtx}`
        : "";

      const steps = [...SUBAGENT_STEPS];
      if (credCtx) {
        const masked = credCtx
          .replace(/\n/g, " | ")
          .replace(/\| key: [^\s|]+/g, "| key:••••");
        steps.splice(1, 0, `System note · ${masked}`);
      }
      if (mockPromptContext.length > 0) {
        steps.splice(
          2,
          0,
          "Loaded vault into subagent prompt context (secrets not shown in log)",
        );
      }

      setBubbles((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "running" as const,
                subagentLog: [credLog],
              }
            : b,
        ),
      );

      let step = 0;
      const iv = setInterval(() => {
        if (step >= steps.length) {
          clearInterval(iv);
          subagentTimers.current.delete(id);
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status: "done" as const } : b,
            ),
          );
          return;
        }
        const line = steps[step];
        step += 1;
        setBubbles((prev) =>
          prev.map((b) =>
            b.id === id
              ? { ...b, subagentLog: [...b.subagentLog, line] }
              : b,
          ),
        );
      }, 900);
      subagentTimers.current.set(id, iv);
    },
    [],
  );

  const sendBubbleMessage = useCallback((id: string, content: string) => {
    const textIn = content.trim();
    if (!textIn) return;
    const current = bubblesRef.current.find((b) => b.id === id);
    if (!current || current.status === "running") return;

    const creds = credentialsRef.current;
    const credLog = buildCredentialsLogLine(creds);
    const isDemo = modeRef.current === "demo";
    const credCtx = buildCredentialsContext(creds, {
      includeSecrets: isDemo,
    });

    const userMsg: CoreMessage = {
      id: uid("msg"),
      role: "user",
      content: textIn,
      createdAt: Date.now(),
    };
    const assistantId = uid("msg");
    const assistantMsg: CoreMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now() + 1,
    };

    setBubbles((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: "running" as const,
              messages: [...(b.messages ?? []), userMsg, assistantMsg],
              subagentLog: [...b.subagentLog, credLog].slice(-16),
            }
          : b,
      ),
    );

    const useLive =
      modeRef.current === "live" && chatModeRef.current === "live";
    if (!useLive) {
      const awareNote = credCtx
        ? ` Acknowledged credentials vault (${creds.filter((c) => c.resource.trim() || c.secret.trim()).length} entries).`
        : "";
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "done" as const,
                messages: (b.messages ?? []).map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: `Acknowledged (demo mock). This sub-agent thread stays in this bubble.${awareNote}\n(${credLog})`,
                      }
                    : m,
                ),
              }
            : b,
        ),
      );
      return;
    }

    const existingAbort = bubbleAbortRef.current.get(id);
    if (existingAbort) existingAbort.abort();
    const ac = new AbortController();
    bubbleAbortRef.current.set(id, ac);

    const historySource = [...(current.messages ?? []), userMsg];
    void (async () => {
      // Keep the parent-context seed (first system message) plus recent turns.
      const history = selectBubbleSendHistory(historySource);

      let assembled = "";
      let failed = false;
      try {
        for await (const chunk of streamOrbitAgent({
          messages: history,
          bubbleContext: {
            title: current.title,
            notes: current.notes.slice(0, 500),
            sourceContent: current.sourceContent.slice(0, 2000),
          },
          credentialsContext: credCtx || undefined,
          user: bubbleSessionUser(id),
          signal: ac.signal,
          engine: "fast",
          timeoutMs: 90000,
          enableTools: true,
        })) {
          if (chunk.type === "token" && chunk.text) {
            assembled += chunk.text;
            const snap = assembled;
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      messages: (b.messages ?? []).map((m) =>
                        m.id === assistantId ? { ...m, content: snap } : m,
                      ),
                    }
                  : b,
              ),
            );
          } else if (chunk.type === "step" && chunk.text) {
            const line = chunk.text;
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      messages: (b.messages ?? []).map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content: assembled
                                ? `${assembled}\n\n_${line}_`
                                : `_${line}_`,
                            }
                          : m,
                      ),
                      subagentLog: [...b.subagentLog, `⚙ ${line}`].slice(-16),
                    }
                  : b,
              ),
            );
          } else if (chunk.type === "error") {
            failed = true;
            const errText = chunk.error || "Live request failed. Try again.";
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      status: "idle" as const,
                      messages: (b.messages ?? []).map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content:
                                assembled.trim() ||
                                `⚠️ Live request failed: ${errText}`,
                            }
                          : m,
                      ),
                    }
                  : b,
              ),
            );
          }
        }
        if (!failed && !assembled.trim()) {
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === id
                ? {
                    ...b,
                    status: "idle" as const,
                    messages: (b.messages ?? []).map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content:
                              "⚠️ Empty engine reply. Try a shorter prompt.",
                          }
                        : m,
                    ),
                  }
                : b,
            ),
          );
        } else if (!failed) {
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status: "done" as const } : b,
            ),
          );
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status: "idle" as const } : b,
            ),
          );
        } else {
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === id
                ? {
                    ...b,
                    status: "idle" as const,
                    messages: (b.messages ?? []).map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content:
                              assembled.trim() ||
                              `⚠️ ${err instanceof Error ? err.message : "Request failed"}`,
                          }
                        : m,
                    ),
                  }
                : b,
            ),
          );
        }
      } finally {
        if (bubbleAbortRef.current.get(id) === ac) {
          bubbleAbortRef.current.delete(id);
        }
      }
    })();
  }, []);

  const playBubble = useCallback(
    (id: string) => {
      sendBubbleMessage(
        id,
        "Investigate this ejected finding and report concise next steps.",
      );
    },
    [sendBubbleMessage],
  );

  const pullToCore = useCallback((id: string) => {
    const timer = subagentTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      subagentTimers.current.delete(id);
    }
    setBubbles((prev) => {
      const b = prev.find((x) => x.id === id);
      if (!b) return prev;
      const chat =
        (b.messages ?? []).filter((m) => m.role !== "system" && m.content.trim())
          .map((m) => `  ${m.role}: ${m.content}`)
          .join("\n")
        || (b.subagentLog.length > 0
          ? b.subagentLog.map((l) => `  · ${l}`).join("\n")
          : "  · (no sub-agent chat yet)");
      const block = [
        "─── Pulled from orbit ───",
        `Bubble: ${b.title}`,
        b.parentTitle ? `Ejected from: ${b.parentTitle}` : null,
        b.sourceExcerpt
          ? `Source ${b.sourceRole}: ${b.sourceExcerpt}`
          : null,
        b.notes.trim() ? `Notes: ${b.notes.trim()}` : null,
        "Source finding:",
        b.sourceContent,
        "Sub-agent chat:",
        chat,
        "─── end pull ───",
      ]
        .filter(Boolean)
        .join("\n");
      const mergeMsg: CoreMessage = {
        id: uid("merge"),
        role: "merge",
        content: block,
        createdAt: Date.now(),
      };
      const parent =
        b.parentId ? prev.find((x) => x.id === b.parentId) : undefined;
      if (parent) {
        return prev
          .map((x) =>
            x.id === parent.id
              ? { ...x, messages: [...(x.messages ?? []), mergeMsg] }
              : x,
          )
          .filter((x) => x.id !== id);
      }
      setMessages((msgs) => [...msgs, mergeMsg]);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const dismissBubble = useCallback((id: string) => {
    const timer = subagentTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      subagentTimers.current.delete(id);
    }
    const pending = bubbleAbortRef.current.get(id);
    if (pending) {
      pending.abort();
      bubbleAbortRef.current.delete(id);
    }
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const appendUserMessage = useCallback(
    (content: string) => {
      const textIn = content.trim();
      if (!textIn) return;
      const creds = credentialsRef.current;
      const credLog = buildCredentialsLogLine(creds);
      const isDemo = modeRef.current === "demo";
      const credCtx = buildCredentialsContext(creds, {
        includeSecrets: isDemo,
      });

      const userMsg: CoreMessage = {
        id: uid("msg"),
        role: "user",
        content: textIn,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const useLive =
        modeRef.current === "live" && chatModeRef.current === "live";
      if (!useLive) {
        // Demo / unauthenticated only — explicit mock, never labeled Live.
        const awareNote = credCtx
          ? ` Acknowledged credentials vault (${creds.filter((c) => c.resource.trim() || c.secret.trim()).length} entries).`
          : "";
        setMessages((prev) => [
          ...prev,
          {
            id: uid("msg"),
            role: "assistant",
            content:
              `Acknowledged (demo mock). Core continues streaming. Eject critical lines for Play.${awareNote}\n(${credLog})`,
            createdAt: Date.now() + 1,
          },
        ]);
        return;
      }

      const assistantId = uid("msg");
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now() + 1,
        },
      ]);
      setStreaming(true);
      if (chatAbortRef.current) chatAbortRef.current.abort();
      const ac = new AbortController();
      chatAbortRef.current = ac;

      void (async () => {
        // Short history + truncated bodies — avoid huge vault+chat payloads.
        const history = [...messagesRef.current, userMsg]
          .filter(
            (m) =>
              m.role === "user" ||
              m.role === "assistant" ||
              m.role === "system",
          )
          .slice(-8)
          .map((m) => {
            const role = (
              m.role === "merge" ? "assistant" : m.role
            ) as "system" | "user" | "assistant";
            let body = m.content;
            if (role === "system" && body.length > 280) {
              body = `${body.slice(0, 280)}…`;
            } else if (body.length > 1200) {
              body = `${body.slice(0, 1200)}…`;
            }
            return { role, content: body };
          });

        let assembled = "";
        let failed = false;
        try {
          for await (const chunk of streamOrbitAgent({
            messages: history,
            credentialsContext: credCtx || undefined,
            signal: ac.signal,
            engine: "fast",
            timeoutMs: 90000,
            enableTools: true,
          })) {
            if (chunk.type === "token" && chunk.text) {
              assembled += chunk.text;
              const snap = assembled;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: snap } : m,
                ),
              );
            } else if (chunk.type === "step" && chunk.text) {
              const line = chunk.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: assembled
                          ? `${assembled}

_${line}_`
                          : `_${line}_`,
                      }
                    : m,
                ),
              );
            } else if (chunk.type === "error") {
              failed = true;
              const errText =
                chunk.error ||
                "NanoGrav request failed. Check session and retry.";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          assembled.trim() ||
                          `⚠️ Live request failed: ${errText}\n\nNo mock reply was used. Try again or tap Reset if the thread is noisy.`,
                      }
                    : m,
                ),
              );
            }
          }
          if (!failed && !assembled.trim()) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        "⚠️ Empty engine reply. Core stays ready — try a shorter prompt.",
                    }
                  : m,
              ),
            );
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            /* superseded by a newer send */
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        assembled.trim() ||
                        `⚠️ ${err instanceof Error ? err.message : "Chat failed"}. Live path only — no mock fallback.`,
                    }
                  : m,
              ),
            );
          }
        } finally {
          setStreaming(false);
        }
      })();
    },
    [],
  );

  const addCredential = useCallback(
    (draft?: Partial<Pick<OrbitCredential, "resource" | "secret" | "usage">>) => {
      setCredentialsOpen(true);
      setCredentials((prev) => [
        ...prev,
        {
          id: uid("cred"),
          resource: draft?.resource || "",
          secret: draft?.secret || "",
          usage: draft?.usage || "",
        },
      ]);
    },
    [],
  );

  const saveToCredentials = useCallback(
    (raw: string) => {
      const draft = parseCredentialFromText(raw);
      addCredential(draft);
      if (modeRef.current === "live" && authenticated) {
        void createOrbitCredential(draft).then((created) => {
          if (!created) return;
          setCredentials((prev) => {
            // Replace the last empty-ish local draft with server id when possible
            const last = prev[prev.length - 1];
            if (
              last &&
              last.resource === draft.resource &&
              last.secret === draft.secret
            ) {
              return prev.map((c, i) =>
                i === prev.length - 1
                  ? {
                      id: created.id,
                      resource: created.resource,
                      secret: created.secret,
                      usage: created.usage,
                    }
                  : c,
              );
            }
            return prev;
          });
        });
      }
    },
    [addCredential, authenticated],
  );

  const refreshCloudStatus = useCallback(async () => {
    if (modeRef.current !== "live") return;
    const cs = await fetchCloudStatus();
    if (cs) setCloudStatus(cs);
  }, []);

  const ensureCloud = useCallback(async () => {
    if (modeRef.current !== "live") return;
    setCloudBusy(true);
    try {
      const cs = await ensureCloudSandbox();
      if (cs) setCloudStatus(cs);
      else await refreshCloudStatus();
    } finally {
      setCloudBusy(false);
    }
  }, [refreshCloudStatus]);

  const updateCredential = useCallback(
    (
      id: string,
      patch: Partial<Pick<OrbitCredential, "resource" | "secret" | "usage">>,
    ) => {
      setCredentials((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const removeCredential = useCallback((id: string) => {
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const resetWorkspace = useCallback(() => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    setStreaming(false);
    subagentTimers.current.forEach((t) => clearInterval(t));
    subagentTimers.current.clear();
    bubbleAbortRef.current.forEach((ac) => ac.abort());
    bubbleAbortRef.current.clear();
    streamIndexRef.current = 0;
    setBubbles([]);
    setSelectedMessageId(null);
    setCoreShapeState("round");
    // Wipe chat + bubbles only — vault credentials stay unless user clears them.
    setMessages(initialMessagesFor(modeRef.current));
    try {
      localStorage.removeItem(storageKeyFor(modeRef.current));
      // Also clear legacy shared keys so a hard refresh cannot revive old demo chat.
      for (const k of LEGACY_STORAGE_KEYS) {
        localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<OrbitStore>(
    () => ({
      ready,
      messages,
      bubbles,
      selectedMessageId,
      viewport,
      credentials,
      coreShape,
      setCoreShape,
      setViewport,
      selectMessage,
      ejectToOrbit,
      updateBubble,
      setBubbleShape,
      resizeBubble,
      nudgeBubbleSize,
      playBubble,
      sendBubbleMessage,
      pullToCore,
      dismissBubble,
      appendUserMessage,
      resetWorkspace,
      addCredential,
      updateCredential,
      removeCredential,
      saveToCredentials,
      credentialsOpen,
      setCredentialsOpen,
      mode,
      authenticated,
      chatMode,
      cloudStatus,
      cloudBusy,
      refreshCloudStatus,
      ensureCloud,
      streaming,
    }),
    [
      ready,
      messages,
      bubbles,
      selectedMessageId,
      viewport,
      credentials,
      coreShape,
      setCoreShape,
      setViewport,
      selectMessage,
      ejectToOrbit,
      updateBubble,
      setBubbleShape,
      resizeBubble,
      nudgeBubbleSize,
      playBubble,
      sendBubbleMessage,
      pullToCore,
      dismissBubble,
      appendUserMessage,
      resetWorkspace,
      addCredential,
      updateCredential,
      removeCredential,
      saveToCredentials,
      credentialsOpen,
      mode,
      authenticated,
      chatMode,
      cloudStatus,
      cloudBusy,
      refreshCloudStatus,
      ensureCloud,
      streaming,
    ],
  );

  return createElement(OrbitCtx.Provider, { value }, children);
}

export function useOrbitStore(): OrbitStore {
  const ctx = useContext(OrbitCtx);
  if (!ctx) {
    throw new Error("useOrbitStore must be used within OrbitProvider");
  }
  return ctx;
}
