import { describe, expect, it } from "vitest";
import { buildPastConversationDigest, type MemoryRow } from "./chatMemory";

const LABELS = { user: "Asha", assistant: "Coach" };

function row(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  msOffset = 0,
): MemoryRow {
  return { sessionId, role, content, createdAt: new Date(1_000 + msOffset) };
}

describe("buildPastConversationDigest", () => {
  it("returns null when there are no rows", () => {
    expect(buildPastConversationDigest([], "s-current", LABELS)).toBeNull();
  });

  it("returns null when the only rows belong to the current session", () => {
    const rows = [
      row("s-current", "user", "hi"),
      row("s-current", "assistant", "hello"),
    ];
    expect(buildPastConversationDigest(rows, "s-current", LABELS)).toBeNull();
  });

  it("excludes the current session and digests only past sessions", () => {
    const rows = [
      row("s-old", "user", "What are fractions?", 0),
      row("s-old", "assistant", "Great question!", 1),
      row("s-current", "user", "today's message", 2),
    ];
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    expect(digest).not.toBeNull();
    expect(digest!.sessionCount).toBe(1);
    expect(digest!.transcript).toContain("Asha: What are fractions?");
    expect(digest!.transcript).toContain("Coach: Great question!");
    expect(digest!.transcript).not.toContain("today's message");
  });

  it("counts distinct past sessions", () => {
    const rows = [
      row("s-1", "user", "a", 0),
      row("s-2", "user", "b", 1),
      row("s-3", "user", "c", 2),
      row("s-current", "user", "d", 3),
    ];
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    expect(digest!.sessionCount).toBe(3);
  });

  it("labels assistant vs user turns correctly", () => {
    const rows = [
      row("s-old", "assistant", "from the coach", 0),
      row("s-old", "user", "from the kid", 1),
    ];
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    const lines = digest!.transcript.split("\n");
    expect(lines[0]).toBe("Coach: from the coach");
    expect(lines[1]).toBe("Asha: from the kid");
  });

  it("collapses whitespace and truncates long messages to 400 chars", () => {
    const long = "z".repeat(500);
    const rows = [row("s-old", "user", `  multi\n\nline   word  `, 0), row("s-old", "user", long, 1)];
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    expect(digest!.transcript).toContain("Asha: multi line word");
    const longLine = digest!.transcript.split("\n").find((l) => l.includes("z"))!;
    expect(longLine).toBe(`Asha: ${"z".repeat(400)}`);
  });

  it("keeps only the 40 most-recent past turns", () => {
    const rows: MemoryRow[] = [];
    for (let i = 0; i < 50; i++) {
      rows.push(row("s-old", "user", `msg-${i}`, i));
    }
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    const lines = digest!.transcript.split("\n");
    expect(lines).toHaveLength(40);
    expect(lines[0]).toBe("Asha: msg-10");
    expect(lines[39]).toBe("Asha: msg-49");
  });

  it("drops rows that are blank after trimming", () => {
    const rows = [
      row("s-old", "user", "   ", 0),
      row("s-old", "assistant", "real reply", 1),
    ];
    const digest = buildPastConversationDigest(rows, "s-current", LABELS);
    expect(digest!.transcript).toBe("Coach: real reply");
  });

  it("returns null when all past rows are blank after trimming", () => {
    const rows = [row("s-old", "user", "   ", 0), row("s-old", "assistant", "\n\n", 1)];
    expect(buildPastConversationDigest(rows, "s-current", LABELS)).toBeNull();
  });
});
