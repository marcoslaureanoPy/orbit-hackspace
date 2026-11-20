/** Static CSS mock of the real Orbit workspace — used on marketing landing. */
export function OrbitProductMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[rgba(61,207,176,0.28)] bg-[#050607] shadow-[0_0_60px_rgba(61,207,176,0.12),0_24px_80px_rgba(0,0,0,0.55)] ${className}`}
      aria-hidden
    >
      <div className="relative aspect-[16/10] w-full min-h-[280px]">
        {/* gravity glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(61,207,176,0.16) 0%, rgba(61,207,176,0.04) 40%, transparent 70%)",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(61,207,176,0.1)]" />
        <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgba(61,207,176,0.14)]" />

        {/* spokes */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 500">
          <defs>
            <linearGradient id="mockSpoke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(61,207,176,0.5)" />
              <stop offset="100%" stopColor="rgba(61,207,176,0.08)" />
            </linearGradient>
          </defs>
          <path
            d="M400 250 Q 520 180 640 120"
            stroke="url(#mockSpoke)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
          />
          <path
            d="M400 250 Q 520 300 660 340"
            stroke="url(#mockSpoke)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
          />
          <path
            d="M400 250 Q 280 160 160 130"
            stroke="url(#mockSpoke)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
          />
        </svg>

        {/* center core */}
        <div className="absolute left-1/2 top-1/2 z-20 flex h-[46%] w-[32%] min-w-[160px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-[rgba(61,207,176,0.35)] bg-[rgba(10,12,14,0.92)] shadow-[0_0_40px_rgba(61,207,176,0.15)] backdrop-blur-sm">
          <div className="flex items-center gap-1.5 px-[18%] pb-1 pt-[14%]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3dcfb0]" />
            <span className="truncate text-[10px] font-medium text-white/90">
              Orbit Core
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-hidden px-[14%] py-1">
            <div className="rounded border border-white/5 bg-black/30 px-1.5 py-1">
              <p className="font-mono text-[7px] uppercase text-[#3dcfb0]/80">
                assistant
              </p>
              <p className="text-[8px] leading-snug text-white/70">
                SSRF on /api/proxy · param url=
              </p>
            </div>
            <div className="rounded border border-[#3dcfb0]/40 bg-[#3dcfb0]/10 px-1.5 py-1">
              <p className="font-mono text-[7px] uppercase text-[#3dcfb0]">
                selected
              </p>
              <p className="text-[8px] leading-snug text-white/75">
                JWT in localStorage · ng_token
              </p>
            </div>
            <div className="rounded border border-white/5 bg-black/30 px-1.5 py-1">
              <p className="font-mono text-[7px] uppercase text-cyan-300/80">
                user
              </p>
              <p className="text-[8px] leading-snug text-white/70">
                Eject the JWT finding
              </p>
            </div>
          </div>
          <div className="px-[16%] pb-[12%] pt-1">
            <div className="rounded-full bg-[#3dcfb0] py-1 text-center text-[8px] font-medium text-[#04110e]">
              ↗ Eject to orbit
            </div>
          </div>
        </div>

        {/* bubble top-right */}
        <div className="absolute right-[6%] top-[10%] z-30 w-[22%] min-w-[120px] rounded-xl border border-[rgba(61,207,176,0.4)] bg-[rgba(8,10,12,0.95)] p-2 shadow-[0_0_28px_rgba(61,207,176,0.12)]">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[9px] font-medium text-white/90">
              JWT token leak
            </span>
            <span className="font-mono text-[7px] uppercase text-[#3dcfb0]">
              Done
            </span>
          </div>
          <p className="mt-1 font-mono text-[7px] leading-snug text-white/55">
            localStorage ng_token · Save to credentials
          </p>
          <div className="mt-1.5 flex gap-1">
            <span className="rounded bg-[#3dcfb0]/90 px-1.5 py-0.5 text-[7px] font-medium text-[#04110e]">
              ▶ Play
            </span>
            <span className="rounded border border-[#3dcfb0]/40 px-1.5 py-0.5 text-[7px] text-[#3dcfb0]">
              ↙ Pull
            </span>
          </div>
        </div>

        {/* bubble bottom-right */}
        <div className="absolute bottom-[14%] right-[4%] z-30 w-[20%] min-w-[110px] rounded-xl border border-[rgba(61,207,176,0.35)] bg-[rgba(8,10,12,0.95)] p-2">
          <div className="flex items-center justify-between">
            <span className="truncate text-[9px] font-medium text-white/90">
              SSRF proxy
            </span>
            <span className="font-mono text-[7px] uppercase text-amber-400/90">
              Running
            </span>
          </div>
          <p className="mt-1 font-mono text-[7px] text-white/50">
            Subagent · probing /api/proxy…
          </p>
        </div>

        {/* bubble left */}
        <div className="absolute left-[5%] top-[18%] z-30 flex h-[16%] w-[14%] min-w-[72px] items-center justify-center rounded-full border border-[rgba(61,207,176,0.4)] bg-[rgba(8,10,12,0.95)] p-2 text-center">
          <div>
            <p className="text-[8px] font-medium text-white/85">Notes</p>
            <p className="mt-0.5 font-mono text-[6px] text-white/50">Idle</p>
          </div>
        </div>

        {/* credentials panel */}
        <div className="absolute bottom-3 left-3 z-30 w-[28%] min-w-[140px] rounded-lg border border-[rgba(61,207,176,0.3)] bg-[rgba(8,10,12,0.94)] p-2">
          <p className="text-[9px] font-medium text-white/90">
            Credentials &amp; keys
          </p>
          <p className="font-mono text-[7px] text-white/45">
            2 stored · known to Orbit AI
          </p>
          <div className="mt-1.5 space-y-1">
            <div className="rounded border border-white/10 bg-black/40 px-1.5 py-1">
              <p className="font-mono text-[7px] text-white/40">Resource</p>
              <p className="text-[8px] text-white/75">api.target.tld</p>
            </div>
            <div className="rounded border border-dashed border-[#3dcfb0]/30 px-1.5 py-1 text-center text-[8px] text-[#3dcfb0]">
              + Add credential
            </div>
          </div>
        </div>

        {/* cloud badge */}
        <div className="absolute right-3 top-3 z-30 rounded-md border border-[rgba(61,207,176,0.25)] bg-[rgba(8,10,12,0.9)] px-2 py-1">
          <p className="font-mono text-[7px] uppercase text-white/40">
            VPS agent
          </p>
          <p className="text-[9px] text-[#3dcfb0]">Running</p>
        </div>
      </div>
    </div>
  );
}
