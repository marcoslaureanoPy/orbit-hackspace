import { NextRequest, NextResponse } from "next/server";
import { requestUnlocked, unauthorized } from "@/lib/gate";
import { agentChat } from "@/lib/openclaw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stream proxy → configured agent (OpenClaw / OpenAI-compatible). */
export async function POST(req: NextRequest) {
  if (!requestUnlocked(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await agentChat(body, { stream: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          message: err instanceof Error ? err.message : "Agent unreachable",
          type: "proxy_error",
        },
      },
      { status: 502 },
    );
  }

  const ct = upstream.headers.get("content-type") || "";
  if (ct.includes("text/event-stream") && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": ct || "application/json" },
  });
}
