/** Build a compact parent-context seed when ejecting a message into its own sub-agent session. */

export type SeedMessage = {
  id: string;
  role: "assistant" | "user" | "system" | "merge";
  content: string;
  createdAt: number;
};

export const MAX_SEED_CHARS = 8000;
export const MAX_SEED_MESSAGE_CHARS = 1200;
export const MAX_CHOSEN_CHARS = 2000;

export function excerptOf(content: string, n = 56): string {
  const one = content.replace(/\s+/g, " ").trim();
  if (!one) return "(empty)";
  return one.length > n ? `${one.slice(0, n).trim()}…` : one;
}

export function truncateText(content: string, max: number): string {
  if (content.length <= max) return content;
  return `${content.slice(0, max).trim()}…`;
}

export function parentLabel(kind: "core" | "bubble", title?: string): string {
  if (kind === "core") return "Core";
  const t = (title || "").replace(/\s+/g, " ").trim();
  return t ? `Bubble “${excerptOf(t, 40)}”` : "a sub-agent bubble";
}

/**
 * Keep the chosen message plus earlier parent turns, trimmed to a character budget.
 * Always includes a short system note: this is a sub-agent continuing that part.
 */
export function buildEjectedSeed(args: {
  parentMessages: SeedMessage[];
  chosenId: string;
  parentLabel: string;
  newId: () => string;
}): { seedMessages: SeedMessage[]; chosen: SeedMessage; trimmed: boolean } | null {
  const { parentMessages, chosenId, parentLabel: from, newId } = args;
  const idx = parentMessages.findIndex((m) => m.id === chosenId);
  if (idx < 0) return null;
  const chosen = parentMessages[idx];

  const prefix = parentMessages.slice(0, idx + 1);
  const bodies: Array<{ role: SeedMessage["role"]; content: string; createdAt: number }> = [];
  let used = 0;
  let trimmed = false;

  for (let i = prefix.length - 1; i >= 0; i--) {
    const m = prefix[i];
    const max = i === idx ? MAX_CHOSEN_CHARS : MAX_SEED_MESSAGE_CHARS;
    const content = truncateText(m.content, max);
    if (i < idx && used + content.length > MAX_SEED_CHARS) {
      trimmed = true;
      break;
    }
    bodies.unshift({ role: m.role, content, createdAt: m.createdAt });
    used += content.length;
  }

  const transcript = bodies
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const intro: SeedMessage = {
    id: newId(),
    role: "system",
    content: [
      "You are an Orbit sub-agent. This is your own session, continuing one part of the parent work.",
      `This bubble was ejected from: ${from}.`,
      `Continue from this ${chosen.role} message:`,
      truncateText(chosen.content, MAX_CHOSEN_CHARS),
      trimmed
        ? "Earlier parent messages were trimmed; the recent work up to the chosen message follows."
        : "Parent conversation history up to and including the chosen message follows. Use it as context for the work.",
      "─── Parent context ───",
      transcript,
      "─── End parent context ───",
    ].join("\n\n"),
    createdAt: Date.now(),
  };

  return { seedMessages: [intro], chosen, trimmed };
}

/** When sending a bubble turn, keep the seed system message and the latest turns. */
export function selectBubbleSendHistory(
  messages: SeedMessage[],
  opts?: { maxTurns?: number },
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const maxTurns = opts?.maxTurns ?? 8;
  const usable = messages.filter(
    (m) =>
      m.role === "user" ||
      m.role === "assistant" ||
      m.role === "system" ||
      m.role === "merge",
  );
  const firstSystem = usable.find((m) => m.role === "system");
  const rest = usable.filter((m) => m !== firstSystem);
  const turns = rest.slice(-maxTurns);
  const out: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (firstSystem) {
    out.push({
      role: "system",
      content: truncateText(firstSystem.content, MAX_SEED_CHARS + 500),
    });
  }
  for (const m of turns) {
    const role = (m.role === "merge" ? "assistant" : m.role) as
      | "system"
      | "user"
      | "assistant";
    const cap = role === "system" ? MAX_SEED_MESSAGE_CHARS : MAX_SEED_MESSAGE_CHARS;
    out.push({ role, content: truncateText(m.content, cap) });
  }
  return out;
}
