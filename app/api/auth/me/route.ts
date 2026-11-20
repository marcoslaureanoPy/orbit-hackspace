import { requestUnlocked, unauthorized } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requestUnlocked(req)) return unauthorized();
  return Response.json({ ok: true });
}
