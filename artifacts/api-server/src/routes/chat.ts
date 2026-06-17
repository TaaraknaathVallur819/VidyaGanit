import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, chatMessagesTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { detectTopic, buildTutorSystemPrompt, type ChatEntry } from "../lib/tutor";
import { normalizeLanguage } from "../lib/counselor";
import { computeXpAndBadges } from "../lib/xp";
import { streamChat, normalizeProvider, type ChatImage } from "../lib/aiChat";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { requireAuth } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

const DRAW_MARKER_RE = /\[\[DRAW:\s*([\s\S]*?)\]\]/;
const GAME_MARKER_RE = /\[\[GAME(?::[^\]]*)?\]\]/;
// Both markers may appear at the very end of a reply; we withhold streamed text
// from the earliest marker start onward so neither ever leaks to the student.
const MARKER_STARTS = ["[[DRAW:", "[[GAME"];

const MAX_MESSAGE_LEN = 1500;
const MAX_HISTORY_ENTRIES = 20;
const MAX_HISTORY_ENTRY_LEN = 2000;
// ~8 MB binary → ~10.7M base64 chars; cap the whole data URL a little above that.
const MAX_ATTACHMENT_DATAURL_LEN = 11_500_000;
const MAX_ATTACHMENT_TEXT_LEN = 8000;

/**
 * Decode the text content of a non-image attachment when it is something we can
 * read (plain text, csv, json, markdown, etc.). Returns null for binary files
 * (pdf, docx, images handled elsewhere) we can't meaningfully inline.
 */
function decodeTextAttachment(mimeType: string, dataUrl: string): string | null {
  const readableMime =
    mimeType.startsWith("text/") ||
    /^application\/(json|xml|x-yaml|yaml|javascript|csv)$/.test(mimeType);
  if (!readableMime) return null;
  const idx = dataUrl.indexOf("base64,");
  if (idx === -1) return null;
  try {
    const text = Buffer.from(dataUrl.slice(idx + 7), "base64").toString("utf8");
    return text.slice(0, MAX_ATTACHMENT_TEXT_LEN);
  } catch {
    return null;
  }
}

router.post(
  "/chat/message",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "chat-minute" }),
  rateLimit({
    windowMs: 60 * 60_000,
    max: 200,
    keyPrefix: "chat-hour",
    message: "You've done a lot of learning today! 🌟 Please take a break and come back in a little while.",
  }),
  async (req, res): Promise<void> => {
    const parsed = SendChatMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Identity comes from the verified session cookie, never the request body.
    const vidyaId = req.vidyaId as string;
    const { message, attachment } = parsed.data;
    const language = normalizeLanguage(parsed.data.language);

    if (message.length > MAX_MESSAGE_LEN) {
      res
        .status(400)
        .json({ error: "That message is a bit too long — try asking in a shorter way! 😊" });
      return;
    }

    if (attachment) {
      if (
        typeof attachment.dataUrl !== "string" ||
        !attachment.dataUrl.startsWith("data:")
      ) {
        res
          .status(400)
          .json({ error: "Hmm, that file didn't upload correctly. Please try attaching it again! 😊" });
        return;
      }
      if (attachment.dataUrl.length > MAX_ATTACHMENT_DATAURL_LEN) {
        res.status(400).json({
          error:
            "That file is a bit too big for me! 😅 Please attach something smaller (under ~8 MB).",
        });
        return;
      }
    }

    const history = (parsed.data.history ?? [])
      .slice(-MAX_HISTORY_ENTRIES)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_HISTORY_ENTRY_LEN) }));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, vidyaId));

    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

  // One conversation = one sessionId (client-supplied, regenerated when the
  // student clears the chat). Falls back to a fresh id if absent.
  const sessionId = parsed.data.sessionId?.slice(0, 100) || randomUUID();

  // Compliance: append-only log of the student's message, tied to their ID.
  // Note any attachment by name so the Parent Dashboard record stays meaningful.
  const loggedContent = attachment
    ? `${message}${message ? "\n" : ""}[Attached ${attachment.mimeType.startsWith("image/") ? "image" : "file"}: ${attachment.name}]`
    : message;
  try {
    await db.insert(chatMessagesTable).values({
      sessionId,
      studentVidyaId: vidyaId,
      role: "user",
      content: loggedContent,
    });
  } catch (err) {
    req.log.error({ err }, "failed to persist student chat message");
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
  let offerGame = false;
  let fallbackText: string | null = null;

  const streamFlush = (): void => {
    let safeEnd = full.length;
    let markerFound = false;
    for (const ms of MARKER_STARTS) {
      const idx = full.indexOf(ms);
      if (idx !== -1) {
        safeEnd = Math.min(safeEnd, idx);
        markerFound = true;
      }
    }
    if (!markerFound) {
      // Withhold only a trailing run that could still grow into a marker, i.e.
      // the longest suffix of `full` that is a prefix of one of the markers.
      let hold = 0;
      for (const ms of MARKER_STARTS) {
        const maxHold = Math.min(ms.length - 1, full.length);
        for (let k = maxHold; k > 0; k--) {
          if (full.slice(full.length - k) === ms.slice(0, k)) {
            hold = Math.max(hold, k);
            break;
          }
        }
      }
      safeEnd = full.length - hold;
    }
    if (safeEnd > sent) {
      send({ chunk: full.slice(sent, safeEnd) });
      sent = safeEnd;
    }
  };

  // Build the latest user turn. Images go to the vision model directly; readable
  // text files are inlined; anything else is described so the coach can ask the
  // student to photograph or retype the problem instead.
  let userText: string;
  let image: ChatImage | null = null;
  if (attachment && attachment.mimeType.startsWith("image/")) {
    userText =
      message ||
      "I've attached a picture of my maths problem. Please help me solve it step by step using questions — don't just give me the answer.";
    image = { mimeType: attachment.mimeType, dataUrl: attachment.dataUrl };
  } else if (attachment) {
    const fileText = decodeTextAttachment(attachment.mimeType, attachment.dataUrl);
    userText = fileText
      ? `${message || "Please help me with this maths problem."}\n\n[The student attached a file named "${attachment.name}". Its contents are:]\n${fileText}`
      : `${message || "I tried to attach a file."}\n\n[The student attached a file named "${attachment.name}" (type ${attachment.mimeType}), but it is not an image or readable text file, so its contents cannot be seen. Gently let them know and ask them to upload a clear photo of the problem or type it out.]`;
  } else {
    userText = message;
  }

  const provider = normalizeProvider(parsed.data.provider);

  try {
    const stream = streamChat({
      provider,
      system: buildTutorSystemPrompt(context, language),
      history: chatHistory,
      userText,
      image,
    });

    for await (const delta of stream) {
      full += delta;
      streamFlush();
    }

    const drawMatch = full.match(DRAW_MARKER_RE);
    const gameMatch = full.match(GAME_MARKER_RE);
    let visibleEnd = full.length;
    if (drawMatch) {
      imagePrompt = drawMatch[1].trim();
      visibleEnd = Math.min(visibleEnd, drawMatch.index ?? full.length);
    }
    if (gameMatch) {
      offerGame = true;
      visibleEnd = Math.min(visibleEnd, gameMatch.index ?? full.length);
    }
    if (visibleEnd > sent) {
      send({ chunk: full.slice(sent, visibleEnd) });
      sent = visibleEnd;
    }
  } catch (err) {
    req.log.error({ err }, "AI chat completion failed");
    if (sent === 0) {
      fallbackText =
        "Oops! My thinking cap slipped for a second. 😅 Could you ask me that again?";
      send({ chunk: fallbackText });
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

  // The coach occasionally invites the student to play a quick mini-game. The
  // marker is stripped from the text; the client surfaces a "Play" button.
  if (offerGame) {
    send({ game: true });
  }

  // Compliance: append-only log of the tutor's reply (markers stripped). Falls
  // back to the error message actually shown to the child if the AI call failed.
  const assistantText =
    full.replace(DRAW_MARKER_RE, "").replace(GAME_MARKER_RE, "").trim() ||
    (fallbackText ?? "");
  if (assistantText) {
    try {
      await db.insert(chatMessagesTable).values({
        sessionId,
        studentVidyaId: vidyaId,
        role: "assistant",
        content: assistantText,
      });
    } catch (err) {
      req.log.error({ err }, "failed to persist tutor chat message");
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
