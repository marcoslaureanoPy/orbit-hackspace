/**
 * Heuristic parse of URLs / API keys from selected audit text
 * to pre-fill Orbit credentials Resource / Secret / Usage.
 */

export type ParsedCredentialDraft = {
  resource: string;
  secret: string;
  usage: string;
};

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;
const HOST_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const KEY_LINE_RE =
  /(?:api[_?\s-]?key|secret|token|password|passwd|auth|bearer|credential)\s*[:=]\s*['"]?([^\s'"]{8,})/i;
const LONG_TOKEN_RE =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|[A-Za-z0-9_-]{32,})\b/;

function cleanUrl(u: string): string {
  return u.replace(/[.,;:)\]}>]+$/, "");
}

export function parseCredentialFromText(text: string): ParsedCredentialDraft {
  const raw = (text || "").trim();
  if (!raw) {
    return { resource: "", secret: "", usage: "" };
  }

  let resource = "";
  let secret = "";
  let usage = "";

  const urls = raw.match(URL_RE);
  if (urls && urls.length > 0) {
    try {
      const u = new URL(cleanUrl(urls[0]));
      resource = u.hostname || cleanUrl(urls[0]);
      usage = `Captured from finding · ${u.origin}${u.pathname}`.slice(0, 200);
    } catch {
      resource = cleanUrl(urls[0]).slice(0, 120);
    }
  }

  if (!resource) {
    const hosts = raw.match(HOST_RE);
    if (hosts && hosts.length > 0) {
      resource = hosts[0].toLowerCase();
    }
  }

  const keyLine = raw.match(KEY_LINE_RE);
  if (keyLine?.[1]) {
    secret = keyLine[1].trim();
  } else {
    const tok = raw.match(LONG_TOKEN_RE);
    if (tok?.[0]) secret = tok[0];
  }

  if (!usage) {
    const first = raw.split(/\n/).map((l) => l.trim()).find(Boolean) || raw;
    usage = `From Orbit finding: ${first.slice(0, 140)}${first.length > 140 ? "…" : ""}`;
  }

  if (!resource && !secret) {
    // Still open the form with usage = snippet so operator can fill manually
    usage = raw.slice(0, 180);
  }

  return {
    resource: resource.slice(0, 200),
    secret: secret.slice(0, 2000),
    usage: usage.slice(0, 500),
  };
}
