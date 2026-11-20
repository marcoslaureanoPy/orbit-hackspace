import { requestUnlocked, unauthorized } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local-only stub: this portable Orbit has no NanoGrav cloud/vault backend. */
export async function GET(req: Request) {
  if (!requestUnlocked(req)) return unauthorized();
  return Response.json({ items: [], includes_cloud: false, status: null, container_name: null, plan: null });
}

export async function POST(req: Request) {
  if (!requestUnlocked(req)) return unauthorized();
  return Response.json({ ok: false, message: "Not available in this standalone Orbit" }, { status: 200 });
}

export async function PUT(req: Request) {
  if (!requestUnlocked(req)) return unauthorized();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requestUnlocked(req)) return unauthorized();
  return Response.json({ ok: true });
}
