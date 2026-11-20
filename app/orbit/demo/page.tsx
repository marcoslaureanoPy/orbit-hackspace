import type { Metadata } from "next";
import Link from "next/link";
import { OrbitWorkspace } from "@/components/orbit/OrbitWorkspace";

export const metadata: Metadata = {
  title: "Orbit Demo — mock workspace",
  description:
    "Try Orbit locally with a mock stream — no login required. Eject findings, Play subagents, vault credentials.",
};

export default function OrbitDemoPage() {
  return (
    <div className="orbit-page fixed inset-0 z-30 bg-[#050607]">
      <div className="absolute left-3 top-3 z-50 flex flex-wrap items-center gap-2">
        <Link
          href="/orbit"
          className="rounded-full border border-line-soft bg-[rgba(8,10,12,0.9)] px-3 py-1 font-mono text-[10px] text-fg-mute backdrop-blur hover:border-accent/40 hover:text-accent"
        >
          ← Orbit
        </Link>
        <Link
          href="/orbit/app"
          className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[10px] text-accent backdrop-blur hover:bg-accent/20"
        >
          Open real workspace
        </Link>
      </div>
      <OrbitWorkspace mode="demo" />
    </div>
  );
}
