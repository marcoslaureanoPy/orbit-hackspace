/**
 * Orbit agent tool schemas — OpenAI-compatible, same shape IDE sends to
 * POST /nanograv/chat/completions. API filters by plan (Builder/Scout/Operator/Cloud);
 * Orbit BFF runs the tool loop (API does not execute tools server-side).
 */

export type OrbitToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** Tools Orbit enables for live Play + core agent (mirrored IDE request shape). */
export const ORBIT_AGENT_TOOLS: OrbitToolDef[] = [
  {
    type: "function",
    function: {
      name: "http_request",
      description:
        "HTTP request for authorized engagement recon (status, headers, body snippet). Plan-gated by NanoGrav (network tools on Operator/Cloud; Scout HTTP OK; Builder blocked).",
      parameters: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            description: "HTTP method",
          },
          url: { type: "string", description: "Absolute http(s) URL in scope" },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Optional request headers",
          },
          body: { type: "string", description: "Optional request body" },
          timeout_sec: {
            type: "integer",
            description: "Timeout seconds (1-30, default 15)",
          },
        },
        required: ["method", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_terminal_cmd",
      description:
        "Run a short shell command in the user Cloud sandbox ng-cloud-{userId[:8]} via /nanograv/cloud/exec. Prefer when sandbox status is Running. If sandbox is down, the tool returns a clear error — continue with http_request or ask the user to Ensure sandbox.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Shell command (bash -lc), max ~4000 chars",
          },
          timeout_sec: {
            type: "integer",
            description: "Timeout seconds (1-120, default 30)",
          },
        },
        required: ["command"],
      },
    },
  },
];

export const ORBIT_AGENT_SYSTEM = [
  "You are the Orbit agent — a real tool-using assistant, not chat-only.",
  "Use tools when they improve the answer: http_request for in-scope HTTP; run_terminal_cmd for Cloud sandbox shell when available.",
  "Credentials vault context may be injected — use secrets only for authorized steps; never echo raw secrets unless the operator asks.",
  "If a tool fails because the sandbox is not running, say so briefly and continue with available tools (or ask the user to Ensure sandbox on Cloud plan).",
  "Stay concise and actionable. Do not claim you ran a tool without a tool call.",
].join(" ");
