import { expectedCookie, GATE_COOKIE, gateEnabled, passwordMatches } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!gateEnabled()) {
    return Response.json({ ok: true, gate: false });
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password || "";
  } catch {
    return Response.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  if (!passwordMatches(password)) {
    return Response.json({ error: { message: "Wrong password" } }, { status: 401 });
  }
  const proto = (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")).toLowerCase();
  const secure = proto === "https" || Boolean(process.env.ORBIT_PUBLIC_URL?.startsWith("https://"));
  const cookie = [
    `${GATE_COOKIE}=${expectedCookie()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
