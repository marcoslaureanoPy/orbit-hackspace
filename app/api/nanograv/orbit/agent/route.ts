import { NextRequest } from "next/server";
import { requestUnlocked, unauthorized } from "@/lib/gate";
import { agentChat } from "@/lib/openclaw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** Translate OpenAI SSE into Orbit {type:token|step|error|done} events. */
export async function POST(req: NextRequest) {
  if (!requestUnlocked(req)) return unauthorized();

  let body: {
    messages?: unknown;
    max_tokens?: number;
    credentialsContext?: string;
    bubbleContext?: { title?: string; notes?: string; sourceContent?: string };
    user?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid JSON" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (body.credentialsContext?.trim()) {
    messages.push({
      role: "system",
      content:
        "Operator credentials vault (authorized use only). Use when needed; never echo secrets unless asked.\n" +
        body.credentialsContext.trim(),
    });
  }
  if (body.bubbleContext) {
    const b = body.bubbleContext;
    messages.push({
      role: "system",
      content: [
        "You are an Orbit subagent focused on one ejected finding.",
        b.title ? `Bubble title: ${b.title}` : null,
        b.notes?.trim() ? `Operator notes: ${b.notes.trim()}` : null,
        b.sourceContent ? `Source finding:\n${b.sourceContent}` : null,
        "Stay concise and actionable.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
  if (Array.isArray(body.messages)) {
    for (const m of body.messages) {
      if (m && typeof m === "object" && "role" in m) {
        const role = String((m as { role: string }).role);
        const content = (m as { content?: unknown }).content;
        messages.push({
          role,
          content: typeof content === "string" ? content : JSON.stringify(content ?? ""),
        });
      }
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        const upstream = await agentChat(
          { messages, max_tokens: body.max_tokens || 2048, user: body.user },
          { stream: true },
        );
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          let detail = `HTTP ${upstream.status}`;
          try {
            const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
            detail = j.error?.message || j.message || detail;
          } catch {
            if (text) detail = text.slice(0, 400);
          }
          send({ type: "error", error: detail });
          send({ type: "done" });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n");
          buf = parts.pop() || "";
          for (const rawLine of parts) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              send({ type: "done" });
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data) as {
                error?: { message?: string };
                choices?: Array<{ delta?: { content?: string } }>;
              };
              if (chunk.error?.message) {
                send({ type: "error", error: chunk.error.message });
                send({ type: "done" });
                controller.close();
                return;
              }
              const token = chunk.choices?.[0]?.delta?.content;
              if (typeof token === "string" && token.length > 0) {
                send({ type: "token", text: token });
              }
            } catch {
              /* skip */
            }
          }
        }
        send({ type: "done" });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Agent loop failed",
        });
        send({ type: "done" });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
