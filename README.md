# Orbit

Standalone copy of the Orbit hackspace interface: a hub-and-spoke workspace (core stream + orbital bubbles + Play subagents + credentials vault).

It talks to whatever you put in `.env` — a local [OpenClaw](https://docs.openclaw.ai) gateway, or any OpenAI-compatible `POST /v1/chat/completions` endpoint.

## Quick start

```bash
cp .env.example .env
# set AGENT_BASE_URL, AGENT_API_KEY, AGENT_MODEL
npm install
npm run build
npm start -- -H 127.0.0.1 -p 3010
```

Open http://127.0.0.1:3010 — landing at `/orbit`, mock demo at `/orbit/demo`, live workspace at `/orbit/app`.

## Connect OpenClaw

Keep the OpenClaw gateway on loopback only. Do not publish port 18789.

```bash
# enable the Chat Completions surface (off by default)
openclaw config set gateway.http.endpoints.chatCompletions.enabled true --strict-json
openclaw config validate
# restart only if curl http://127.0.0.1:18789/v1/chat/completions still returns 404
openclaw gateway restart
```

Then in `.env`:

```
AGENT_BASE_URL=http://127.0.0.1:18789/v1
AGENT_API_KEY=YOUR_AGENT_TOKEN
AGENT_MODEL=openclaw/default
```

If the UI will be on the public internet, set `ORBIT_ACCESS_PASSWORD`. The live workspace and API stay locked without it. The demo is a local mock and does not call your agent.

## Public link (Caddy)

Bind the Node process to localhost and add one site block. On hosts where `:443` is already taken, use another HTTPS port:

```
your-domain.example {
    reverse_proxy 127.0.0.1:3010
}
```

Back up the Caddyfile, run `caddy validate --config /etc/caddy/Caddyfile` (or your Caddyfile path), then reload Caddy.

A sample systemd unit is in `deploy/orbit.service`.

## What this is (and isn’t)

- This is just the Orbit UI + a small server proxy to your agent.
- No Docker. No bundled login, billing, or cloud sandbox.
- Credentials stay in the browser.
- Never commit `.env` or gateway tokens.

## Español (corto)

Copia portable de la interfaz Orbit. Configura el agente en `.env`, arranca `npm start` en un puerto local, y publica con un bloque de Caddy. Para OpenClaw en la misma máquina: activa `gateway.http.endpoints.chatCompletions` (solo en loopback) y usa el token del gateway como `AGENT_API_KEY`. Si el link es público, pon `ORBIT_ACCESS_PASSWORD`.
