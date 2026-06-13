import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { generateSocraticResponse, type ChatEntry } from "../lib/tutor";

const router: IRouter = Router();

router.post("/chat/message", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vidyaId, message, history } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vidyaId, vidyaId));

  if (!user) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const context = {
    name: user.name,
    studentClass: user.studentClass ?? null,
    board: user.board ?? null,
  };

  const chatHistory: ChatEntry[] = (history ?? []).map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));

  const responseText = generateSocraticResponse(message, context, chatHistory);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const words = responseText.split(" ");
  for (const word of words) {
    await new Promise<void>((resolve) => setTimeout(resolve, 22));
    res.write(`data: ${JSON.stringify({ chunk: word + " " })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
