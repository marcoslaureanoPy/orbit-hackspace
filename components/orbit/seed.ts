/** Seed + slow-append simulated pentest stream for Orbit core. */

export type SeedLine = {
  role: "assistant" | "user" | "system";
  content: string;
};

export const SEED_MESSAGES: SeedLine[] = [
  {
    role: "system",
    content:
      "Orbit core online · authorized scope: acme-staging.example.lab · mode: assisted pentest",
  },
  {
    role: "user",
    content: "Start recon on the staging perimeter. Prioritize auth and IDOR.",
  },
  {
    role: "assistant",
    content:
      "Recon started. Fingerprinted nginx/1.25 + Next.js behind Cloudflare. Discovered /api/v1/users, /api/v1/orders, /admin (403). JWT in localStorage key `ng_token` — same pattern as production docs.",
  },
  {
    role: "assistant",
    content:
      "CONFIRMED · Weak JWT signing (HS256, guessable secret candidate). Token for user `auditor@acme.test` validates on /api/v1/orders. Escalate: forge admin claim and probe IDOR on order IDs 1001–1020.",
  },
  {
    role: "assistant",
    content:
      "CONFIRMED · IDOR on GET /api/v1/orders/{id}: order 1007 returns PII for another tenant (email, last4 card). Vector chain: JWT forge → IDOR → data exfil. Recommend pinning this into Orbit for focused subagent follow-up.",
  },
];

export const STREAM_APPEND: SeedLine[] = [
  {
    role: "assistant",
    content:
      "Scanning GraphQL introspection… __schema exposed on /graphql. Mutations: createInvite, resetPassword — no rate limit headers observed.",
  },
  {
    role: "assistant",
    content:
      "SSR Fuzz: /audit/[id] leaks internal job UUID in HTML comment when unauthenticated. Correlating with earlier JWT findings.",
  },
  {
    role: "assistant",
    content:
      "Passive: CSP allows 'unsafe-inline'. XSS sink candidates in Tip toast renderer — queued for bubble if you want a dedicated Play.",
  },
  {
    role: "assistant",
    content:
      "New host: ops-internal.acme-staging.lab resolves privately. Port 8443 TLS cert CN mismatch. Logging for later lateral path.",
  },
  {
    role: "assistant",
    content:
      "Rate-limit probe on /api/auth/login: 120 req/min accepted, then 429. Lockout not present — credential stuffing residual risk.",
  },
  {
    role: "assistant",
    content:
      "Still streaming core findings. Pin anything critical with Eject to orbit — I will keep going while you organize.",
  },
];

export const SUBAGENT_STEPS = [
  "Subagent attached · snapshot of core + bubble payload loaded",
  "Replaying confirmed vector chain in isolated context…",
  "Validating JWT forge path with narrowed claims set",
  "Probing IDOR order range with forged token (mock)",
  "Drafting merge block: severity, repro steps, fix guidance",
  "Subagent complete · ready to Pull to core",
];
