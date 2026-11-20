import { createHmac, timingSafeEqual } from "crypto";

export const GATE_COOKIE = "orbit_access";

export function gateEnabled(): boolean {
  return Boolean(process.env.ORBIT_ACCESS_PASSWORD);
}

export function expectedCookie(): string {
  const pw = process.env.ORBIT_ACCESS_PASSWORD || "";
  const secret = process.env.ORBIT_SESSION_SECRET || pw || "dev";
  return createHmac("sha256", secret).update(`orbit:${pw}`).digest("hex");
}

export function passwordMatches(password: string): boolean {
  const expected = process.env.ORBIT_ACCESS_PASSWORD || "";
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length) {
    const dummy = Buffer.alloc(32);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function requestUnlocked(req: Request): boolean {
  if (!gateEnabled()) return true;
  const header = req.headers.get("cookie") || "";
  const match = header.match(/(?:^|;\s*)orbit_access=([^;]+)/);
  if (!match) return false;
  const got = Buffer.from(match[1]);
  const exp = Buffer.from(expectedCookie());
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}

export function unauthorized() {
  return Response.json({ error: { message: "Unlock required" } }, { status: 401 });
}
