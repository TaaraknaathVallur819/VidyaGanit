import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import type OpenAI from "openai";
import { db, usersTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { detectTopic, buildTutorSystemPrompt, type ChatEntry } from "../lib/tutor";
import { computeXpAndBadges } from "../lib/xp";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();

const DRAW_MARKER_RE = /\[\[DRAW:\s*([\s\S]*?)\]\]/;
const DRAW_MARKER_START = "[[DRAW:";

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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (obj: unknown): void => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  // The model may append a `[[DRAW: ...]]` marker at the very end to request an
  // illustration. We stream the conversational text to the client as it arrives
  // but withhold anything from a possible marker onward so it never leaks.
  let full = "";
  let sent = 0;
  let imagePrompt: string | null = null;

  const streamFlush = (): void => {
    let safeEnd: number;
    const markerIdx = full.indexOf(DRAW_MARKER_START);
    if (markerIdx !== -1) {
      // A full marker prefix is present — withhold everything from it onward.
      safeEnd = markerIdx;
    } else {
      // Withhold only a trailing run that could still grow into the marker,
      // i.e. the longest suffix of `full` that is a prefix of "[[DRAW:".
      let hold = 0;
      const maxHold = Math.min(DRAW_MARKER_START.length - 1, full.length);
      for (let k = maxHold; k > 0; k--) {
        if (full.slice(full.length - k) === DRAW_MARKER_START.slice(0, k)) {
          hold = k;
          break;
        }
      }
      safeEnd = full.length - hold;
    }
    if (safeEnd > sent) {
      send({ chunk: full.slice(sent, safeEnd) });
      sent = safeEnd;
    }
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildTutorSystemPrompt(context) },
    ...chatHistory.map(
      (h): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
        h.role === "assistant"
          ? { role: "assistant", content: h.content }
          : { role: "user", content: h.content },
    ),
    { role: "user", content: message },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      stream: true,
      messages,
    });

    for await (const part of stream) {
      const content = part.choices[0]?.delta?.content;
      if (content) {
        full += content;
        streamFlush();
      }
    }

    const match = full.match(DRAW_MARKER_RE);
    let visibleEnd = full.length;
    if (match) {
      imagePrompt = match[1].trim();
      visibleEnd = match.index ?? full.length;
    }
    if (visibleEnd > sent) {
      send({ chunk: full.slice(sent, visibleEnd) });
      sent = visibleEnd;
    }
  } catch (err) {
    req.log.error({ err }, "AI chat completion failed");
    if (sent === 0) {
      send({
        chunk:
          "Oops! My thinking cap slipped for a second. 😅 Could you ask me that again?",
      });
    }
  }

  if (imagePrompt) {
    send({ drawing: true });
    try {
      const buffer = await generateImageBuffer(
        `Clean, simple, colourful, kid-friendly educational illustration for a primary-school maths lesson. ${imagePrompt}. Flat vector style, clearly labelled, friendly, plain white background. Do not show the final numeric answer.`,
        "1024x1024",
      );
      send({
        image: `data:image/png;base64,${buffer.toString("base64")}`,
        imageAlt: imagePrompt,
      });
    } catch (err) {
      req.log.error({ err }, "AI image generation failed");
      send({ imageError: true });
    }
  }

  const topic = detectTopic(message);
  const { xpGained, newBadges } = computeXpAndBadges({
    topic,
    message,
    currentXp: user.xp ?? 0,
    existingBadges: user.badges ?? [],
    historyLength: chatHistory.length,
  });

  const newXp = (user.xp ?? 0) + xpGained;
  const allBadges = [...new Set([...(user.badges ?? []), ...newBadges])];

  await db
    .update(usersTable)
    .set({ xp: newXp, badges: allBadges })
    .where(eq(usersTable.vidyaId, vidyaId));

  send({ done: true, xpAwarded: xpGained, newBadges });
  res.end();
});

export default router;
