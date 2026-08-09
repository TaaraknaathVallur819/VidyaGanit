import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, usersTable, chatMessagesTable } from "@workspace/db";
import {
  SendChatMessageBody,
  ListChatSessionsParams,
  ListChatSessionsResponse,
  GetChatSessionParams,
  GetChatSessionResponse,
  SetChatMessageFeedbackParams,
  SetChatMessageFeedbackBody,
  SetChatMessageFeedbackResponse,
} from "@workspace/api-zod";
import {
  detectTopic,
  buildTutorSystemPrompt,
  type ChatEntry,
  type Topic,
  type StudentTopicProgress,
} from "../lib/tutor";
import { normalizeLanguage } from "../lib/counselor";
import { computeStudentAnalytics } from "../lib/analytics";
import { buildPastConversationDigest } from "../lib/chatMemory";
import { computeXpAndBadges } from "../lib/xp";
import { computeStreakOnActivity } from "../lib/streak";
import {
  streamChat,
  normalizeChatModel,
  normalizeChatModelInput,
  type ChatImage,
} from "../lib/aiChat";
import { generateImageDataUrl, normalizeImageModel } from "../lib/aiImage";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

const DRAW_MARKER_RE = /\[\[DRAW:\s*([\s\S]*?)\]\]/;
const GAME_MARKER_RE = /\[\[GAME(?::[^\]]*)?\]\]/;
const TEST_MARKER_RE = /\[\[TEST(?::[^\]]*)?\]\]/;
// All markers may appear at the very end of a reply; we withhold streamed text
// from the earliest marker start onward so none of them ever leak to the student.
const MARKER_STARTS = ["[[DRAW:", "[[GAME", "[[TEST"];

// Recognisable maths topics that should always trigger a "play a game?" offer
// when the student raises a fresh question. Greetings, "give up" pleas and
// vague/general messages are intentionally excluded.
const OFFER_GAME_TOPICS: ReadonlySet<Topic> = new Set<Topic>([
  "fraction",
  "multiply",
  "divide",
  "add_subtract",
  "percent",
  "geometry",
  "algebra",
  "decimal",
  "ratio",
]);

// A real new question is more than a one- or two-word reply (which is usually a
// mid-step answer to the coach's guiding question). This keeps us from popping
// the game prompt while the student is concentrating on solving a step.
function isLikelyNewQuestion(message: string): boolean {
  return message.trim().split(/\s+/).filter(Boolean).length >= 4;
}

const MAX_MESSAGE_LEN = 1500;
// Keep the FULL conversation available to the tutor (not just recent turns) so
// it remembers everything the student has worked through in a session. This is a
// generous upper bound for any realistic conversation while still guarding the
// model's context window / cost against a pathologically long history.
const MAX_HISTORY_ENTRIES = 200;
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
    const requestBody =
      req.body && typeof req.body === "object"
        ? {
            ...req.body,
            chatModel: normalizeChatModelInput(req.body.chatModel),
          }
        : req.body;
    const parsed = SendChatMessageBody.safeParse(requestBody);
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

  // Ground the tutor in what the student has actually practised so far.
  let progress: { totalSessions: number; topics: StudentTopicProgress[] } | null = null;
  try {
    const analytics = await computeStudentAnalytics(vidyaId);
    progress = { totalSessions: analytics.totalSessions, topics: analytics.topics };
  } catch (err) {
    req.log.error({ err }, "failed to compute student analytics for tutor prompt");
  }

  // Long-term memory: let the tutor refer back to earlier chats (across past
  // sessions) even in a brand-new conversation. Best-effort — never block chat.
  let pastMemory: { sessionCount: number; transcript: string } | null = null;
  try {
    const memRows = await db
      .select({
        role: chatMessagesTable.role,
        content: chatMessagesTable.content,
        createdAt: chatMessagesTable.createdAt,
        sessionId: chatMessagesTable.sessionId,
      })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.studentVidyaId, vidyaId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(300);
    memRows.reverse();
    pastMemory = buildPastConversationDigest(memRows, sessionId, {
      user: user.name.split(" ")[0] || "Student",
      assistant: "Coach",
    });
  } catch (err) {
    req.log.error({ err }, "failed to load past chat memory for tutor prompt");
  }

  const context = {
    name: user.name,
    studentClass: user.studentClass ?? null,
    board: user.board ?? null,
    aboutMe: user.aboutMe ?? null,
    progress,
    pastMemory,
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
  let offerTest = false;
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

  const chatModel = normalizeChatModel(parsed.data.chatModel);
  const imageModel = normalizeImageModel(parsed.data.imageModel);

  try {
    const stream = streamChat({
      provider: chatModel.provider,
      model: chatModel.model,
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
    const testMatch = full.match(TEST_MARKER_RE);
    let visibleEnd = full.length;
    if (drawMatch) {
      imagePrompt = drawMatch[1].trim();
      visibleEnd = Math.min(visibleEnd, drawMatch.index ?? full.length);
    }
    if (gameMatch) {
      offerGame = true;
      visibleEnd = Math.min(visibleEnd, gameMatch.index ?? full.length);
    }
    if (testMatch) {
      offerTest = true;
      visibleEnd = Math.min(visibleEnd, testMatch.index ?? full.length);
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
      const dataUrl = await generateImageDataUrl(
        imageModel,
        [
          "Create ONE accurate educational maths diagram for a primary-school child (ages 9–13).",
          "Draw EXACTLY and ONLY what the description says, with the correct quantities, groupings, divisions, shading and labels. The diagram must be mathematically correct: counts must match exactly (if it says 3 rows of 4, draw exactly 3 rows of 4), shapes and proportions must be right, and every required label must be present and legible.",
          "Do NOT add any extra, decorative or unrelated objects, cartoon characters, mascots, busy backgrounds, or scenery — only the maths concept being taught.",
          "Style: clean flat vector, bright friendly colours, bold simple shapes, large clear labels, plain white background. Keep any text very short and spelled correctly.",
          "Do NOT reveal or write the final numeric answer anywhere in the image.",
          "",
          `Diagram to draw: ${imagePrompt}`,
        ].join("\n"),
      );
      send({
        image: dataUrl,
        imageAlt: imagePrompt,
      });
    } catch (err) {
      req.log.error({ err }, "AI image generation failed");
      send({ imageError: true });
    }
  }

  // Always offer a quick warm-up game when the student asks a fresh question
  // about a recognisable maths topic — not only when the model remembers to
  // emit the [[GAME]] marker. The marker still works, but this guarantees the
  // Yes/No prompt the student expects on every new topic question. The text is
  // stripped of the marker; the client surfaces the Yes/No buttons.
  const topic = detectTopic(message);
  if (!offerGame && OFFER_GAME_TOPICS.has(topic) && isLikelyNewQuestion(message)) {
    offerGame = true;
  }
  if (offerGame) {
    // Include the detected topic so the client can auto-launch a game tailored
    // to what the student just asked about (instead of opening the menu).
    send({ game: true, topic });
  }

  // The model emits [[TEST]] only when the student is clearly comfortable with
  // the current topic. Offer a graded topic-mastery test for that topic; the
  // client surfaces a Yes/No prompt just like the game offer.
  if (offerTest) {
    send({ test: true, topic });
  }

  // Compliance: append-only log of the tutor's reply (markers stripped). Falls
  // back to the error message actually shown to the child if the AI call failed.
  const assistantText =
    full
      .replace(DRAW_MARKER_RE, "")
      .replace(GAME_MARKER_RE, "")
      .replace(TEST_MARKER_RE, "")
      .trim() || (fallbackText ?? "");
  let assistantMessageId: number | null = null;
  if (assistantText) {
    try {
      const [inserted] = await db
        .insert(chatMessagesTable)
        .values({
          sessionId,
          studentVidyaId: vidyaId,
          role: "assistant",
          content: assistantText,
        })
        .returning({ id: chatMessagesTable.id });
      assistantMessageId = inserted?.id ?? null;
    } catch (err) {
      req.log.error({ err }, "failed to persist tutor chat message");
    }
  }

  const { xpGained, newBadges } = computeXpAndBadges({
    topic,
    message,
    currentXp: user.xp ?? 0,
    existingBadges: user.badges ?? [],
    historyLength: chatHistory.length,
  });

  const newXp = (user.xp ?? 0) + xpGained;
  const allBadges = [...new Set([...(user.badges ?? []), ...newBadges])];

  const streak = computeStreakOnActivity({
    streakCurrent: user.streakCurrent ?? 0,
    streakLongest: user.streakLongest ?? 0,
    lastActiveDate: user.lastActiveDate ?? null,
  });

  await db
    .update(usersTable)
    .set({
      xp: newXp,
      coins: (user.coins ?? 0) + xpGained,
      badges: allBadges,
      streakCurrent: streak.streakCurrent,
      streakLongest: streak.streakLongest,
      lastActiveDate: streak.lastActiveDate,
    })
    .where(eq(usersTable.vidyaId, vidyaId));

  send({ done: true, xpAwarded: xpGained, newBadges, messageId: assistantMessageId });
  res.end();
});

// ── Chat history: list a student's own past tutoring conversations ───
router.get(
  "/chat/:vidyaId/sessions",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = ListChatSessionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select({
        sessionId: chatMessagesTable.sessionId,
        role: chatMessagesTable.role,
        content: chatMessagesTable.content,
        createdAt: chatMessagesTable.createdAt,
      })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.studentVidyaId, params.data.vidyaId))
      .orderBy(asc(chatMessagesTable.createdAt));

    const order: string[] = [];
    const grouped = new Map<
      string,
      { startedAt: Date; lastMessageAt: Date; messageCount: number; preview: string }
    >();
    for (const row of rows) {
      let g = grouped.get(row.sessionId);
      if (!g) {
        g = { startedAt: row.createdAt, lastMessageAt: row.createdAt, messageCount: 0, preview: "" };
        grouped.set(row.sessionId, g);
        order.push(row.sessionId);
      }
      g.lastMessageAt = row.createdAt;
      g.messageCount += 1;
      // Preview = the first student (user) message in the conversation.
      if (!g.preview && row.role === "user" && row.content.trim()) {
        g.preview = row.content.trim().slice(0, 140);
      }
    }

    // Newest activity first.
    const sessions = order
      .map((sessionId) => {
        const g = grouped.get(sessionId)!;
        return {
          sessionId,
          startedAt: g.startedAt.toISOString(),
          lastMessageAt: g.lastMessageAt.toISOString(),
          messageCount: g.messageCount,
          preview: g.preview,
        };
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

    res.json(ListChatSessionsResponse.parse({ sessions }));
  },
);

// ── Chat history: load one of the student's own past conversations ───
router.get(
  "/chat/:vidyaId/sessions/:sessionId/messages",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetChatSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.studentVidyaId, params.data.vidyaId),
          eq(chatMessagesTable.sessionId, params.data.sessionId),
        ),
      )
      .orderBy(asc(chatMessagesTable.createdAt));

    res.json(
      GetChatSessionResponse.parse({
        sessionId: params.data.sessionId,
        messages: rows.map((r) => ({
          id: r.id,
          role: r.role === "assistant" ? "assistant" : "user",
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          feedback: r.feedback === "up" || r.feedback === "down" ? r.feedback : null,
        })),
      }),
    );
  },
);

// ── Like / dislike (or clear) one of the student's own tutor replies ─
router.post(
  "/chat/:vidyaId/messages/:messageId/feedback",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = SetChatMessageFeedbackParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = SetChatMessageFeedbackBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    // Only the assistant turns the student owns can be rated. The ownership
    // filter (studentVidyaId) means a user can never rate someone else's reply.
    const [updated] = await db
      .update(chatMessagesTable)
      .set({ feedback: body.data.feedback })
      .where(
        and(
          eq(chatMessagesTable.id, params.data.messageId),
          eq(chatMessagesTable.studentVidyaId, params.data.vidyaId),
          eq(chatMessagesTable.role, "assistant"),
        ),
      )
      .returning({ id: chatMessagesTable.id, feedback: chatMessagesTable.feedback });

    if (!updated) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    res.json(
      SetChatMessageFeedbackResponse.parse({
        id: updated.id,
        feedback:
          updated.feedback === "up" || updated.feedback === "down"
            ? updated.feedback
            : null,
      }),
    );
  },
);

export default router;
