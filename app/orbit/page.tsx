import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Orbit — Gravity hub for pentest context",
  description:
    "Hub-and-spoke AI workspace: keep the pentest core streaming while you pin critical findings into orbital bubbles, run focused Play subagents, and vault credentials — without poisoning context or dumping to Notepad.",
};

const FEATURES = [
  {
    title: "Gravity core",
    body: "Main agent stream stays in the center. Chat keeps moving — you never freeze the audit to copy-paste.",
  },
  {
    title: "Eject to orbit",
    body: "Select or drag a finding into a bubble. Critical bits live on spokes, not in Telegram or Notepad.",
  },
  {
    title: "Play subagents",
    body: "Run a focused Play on one bubble with core snapshot + notes, then Pull results back into the core.",
  },
  {
    title: "Credentials vault",
    body: "Save URLs/keys from findings into Resource / Secret / Usage. Vault injects into chat + Play — and syncs when logged in.",
  },
] as const;

export default function OrbitLandingPage() {
  return (
    <div className="relative min-h-screen bg-[#050607] text-fg">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(61,207,176,0.12), transparent 55%)",
        }}
        aria-hidden
      />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              Orbit
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              Keep the audit core streaming.
              <span className="mt-1 block text-accent">
                Pin what matters in orbit.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-dim">
              Orbit is not pretty chat. It is a practical hub-and-spoke
              workspace for pentest and authorized hacking: human + AI stay
              aligned without losing context. Critical findings become orbital
              bubbles and optional subagents — instead of poisoning the main
              thread or pasting secrets into Notepad.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/orbit/demo"
                className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04110e] transition-opacity hover:opacity-90"
              >
                Try demo
              </Link>
              <Link
                href="/orbit/app"
                className="inline-flex items-center justify-center rounded-full border border-accent/45 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
              >
                Open workspace
              </Link>
            </div>
            <p className="mt-3 font-mono text-[11px] text-fg-mute">
              Demo = local mock · Workspace = live agent (OpenClaw or any OpenAI-compatible endpoint)
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[rgba(61,207,176,0.28)] bg-[#050607] shadow-[0_0_60px_rgba(61,207,176,0.12),0_24px_80px_rgba(0,0,0,0.55)]">
            <Image
              src="/orbit/orbit-full-workspace.png"
              alt="Orbit workspace: center core chat stream with orbital finding bubbles, spokes, and credentials vault"
              width={1280}
              height={800}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div className="overflow-hidden rounded-2xl border border-[rgba(61,207,176,0.22)] bg-[#050607] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
            <Image
              src="/orbit/orbit-center-core-close.png"
              alt="Close-up of Orbit Core: live finding stream with Eject to orbit action"
              width={960}
              height={720}
              className="h-auto w-full"
            />
          </div>
          <div>
            <h2 className="text-xl font-medium text-fg">
              Built for operators who refuse to lose the thread
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-fg-dim">
              When a finding is critical, eject it. When a key appears, Save to
              credentials. When you need depth, Play a subagent on one bubble —
              then Pull the result back into the gravity core. Parallel context
              without the paste-buffer tax.
            </p>
            <ul className="mt-4 space-y-2 text-[13px] text-fg-mute">
              <li className="flex gap-2">
                <span className="text-accent">▸</span>
                Teal hub-and-spoke UI (#3dcfb0 on #050607) — the real product,
                not a fantasy mockup
              </li>
              <li className="flex gap-2">
                <span className="text-accent">▸</span>
                Live workspace talks to the configured agent (OpenClaw or OpenAI-compatible)
              </li>
              <li className="flex gap-2">
                <span className="text-accent">▸</span>
                Credentials vault stays in your browser unless you add your own backend
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-line-soft bg-[rgba(8,10,12,0.65)] p-4"
            >
              <h2 className="text-sm font-medium text-fg">{f.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-mute">
                {f.body}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-[rgba(61,207,176,0.22)] bg-[rgba(8,10,12,0.7)] p-6 sm:p-8">
          <h2 className="text-lg font-medium text-fg">How a session flows</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              "Core streams from the connected agent.",
              "Eject critical lines → bubbles on spokes. Save keys to the vault.",
              "Play on a bubble · Pull merge back into the core.",
            ].map((step, i) => (
              <li
                key={step}
                className="flex gap-3 rounded-lg border border-line-soft/80 bg-bg/40 p-3 text-[13px] leading-relaxed text-fg-dim"
              >
                <span className="font-mono text-accent">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/orbit/demo"
              className="text-sm font-medium text-accent hover:underline"
            >
              Launch interactive demo →
            </Link>
            <Link
              href="/orbit/app"
              className="text-sm text-fg-mute hover:text-fg"
            >
              Open the live workspace
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
