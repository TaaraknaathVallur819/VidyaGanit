import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  parentStudentLinksTable,
  chatMessagesTable,
  parentChatMessagesTable,
  assessmentsTable,
} from "@workspace/db";
import {
  GetStudentAnalyticsParams,
  GetStudentAnalyticsResponse,
  GetStudentHistoryParams,
  GetStudentHistoryResponse,
  GetStudentAssessmentsParams,
  GetStudentAssessmentsResponse,
  GetStudentRecommendationParams,
  GetStudentRecommendationResponse,
  GetConsultantHistoryParams,
  GetConsultantHistoryResponse,
  ListConsultantSessionsParams,
  ListConsultantSessionsResponse,
  GetConsultantSessionParams,
  GetConsultantSessionResponse,
  SendConsultantMessageParams,
  SendConsultantMessageBody,
  TranscribeConsultantAudioParams,
  TranscribeConsultantAudioBody,
  TranscribeConsultantAudioResponse,
} from "@workspace/api-zod";
import { detectTopic } from "../lib/tutor";
import { ANALYTICS_TOPICS, computeStudentAnalytics } from "../lib/analytics";
import { recommendNextLessons } from "../lib/curriculum";
import {
  buildCounselorSystemPrompt,
  normalizeLanguage,
  type CounselorTopicSummary,
} from "../lib/counselor";
import { streamChat, normalizeChatModel, type ChatImage } from "../lib/aiChat";
import { generateImageDataUrl, normalizeImageModel } from "../lib/aiImage";
import { speechToText, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import { requireAuth, requireSelf } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

const MAX_MESSAGE_LEN = 4000;
// Keep the FULL conversation available to the AI (not just recent turns) so the
// parent/tutor consultant remembers everything discussed in a session. Generous
// upper bound for any realistic conversation while still guarding the model's
// context window / cost against a pathologically long history.
const MAX_HISTORY_ENTRIES = 200;
const MAX_HISTORY_ENTRY_LEN = 4000;
const MAX_ATTACHMENT_DATAURL_LEN = 11_500_000;
const MAX_ATTACHMENT_TEXT_LEN = 8000;
// Audio data URL: ~30s of webm/opus is well under this; cap generously.
const MAX_AUDIO_DATAURL_LEN = 11_500_000;

// The counselor may request an illustration with a trailing [[DRAW: ...]] marker.
const DRAW_MARKER_RE = /\[\[DRAW:\s*([\s\S]*?)\]\]/;
const DRAW_MARKER_START = "[[DRAW:";

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

/**
 * Confirms the given student is actually linked to the authenticated parent.
 * Returns the student row, or null when not linked / not found. This is the
 * authorization gate for every per-student parent endpoint — a parent can only
 * ever see data for children connected to their own account.
 */
async function getLinkedStudent(parentVidyaId: string, studentVidyaId: string) {
  const [row] = await db
    .select({
      vidyaId: usersTable.vidyaId,
      name: usersTable.name,
      studentClass: usersTable.studentClass,
      board: usersTable.board,
    })
    .from(parentStudentLinksTable)
    .innerJoin(usersTable, eq(usersTable.vidyaId, parentStudentLinksTable.studentVidyaId))
    .where(
      and(
        eq(parentStudentLinksTable.parentVidyaId, parentVidyaId),
        eq(parentStudentLinksTable.studentVidyaId, studentVidyaId),
      ),
    );
  return row ?? null;
}

// ── Progress Analytics ──────────────────────────────────────────────
router.get(
  "/parent/:vidyaId/students/:studentVidyaId/analytics",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentAnalyticsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const student = await getLinkedStudent(params.data.vidyaId, params.data.studentVidyaId);
    if (!student) {
      res.status(403).json({ error: "This student is not linked to your account." });
      return;
    }

    const analytics = await computeStudentAnalytics(student.vidyaId);

    res.json(
      GetStudentAnalyticsResponse.parse({
        studentVidyaId: student.vidyaId,
        name: student.name,
        studentClass: student.studentClass ?? null,
        board: student.board ?? null,
        ...analytics,
      }),
    );
  },
);

// ── Saved Socratic History ──────────────────────────────────────────
router.get(
  "/parent/:vidyaId/students/:studentVidyaId/history",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const student = await getLinkedStudent(params.data.vidyaId, params.data.studentVidyaId);
    if (!student) {
      res.status(403).json({ error: "This student is not linked to your account." });
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
      .where(eq(chatMessagesTable.studentVidyaId, student.vidyaId))
      .orderBy(asc(chatMessagesTable.createdAt));

    const order: string[] = [];
    const grouped = new Map<
      string,
      { startedAt: Date; messages: { role: "user" | "assistant"; content: string; createdAt: Date }[] }
    >();
    for (const row of rows) {
      let g = grouped.get(row.sessionId);
      if (!g) {
        g = { startedAt: row.createdAt, messages: [] };
        grouped.set(row.sessionId, g);
        order.push(row.sessionId);
      }
      g.messages.push({
        role: row.role === "assistant" ? "assistant" : "user",
        content: row.content,
        createdAt: row.createdAt,
      });
    }

    // Newest conversation first.
    const sessions = order
      .map((sessionId) => {
        const g = grouped.get(sessionId)!;
        return {
          sessionId,
          startedAt: g.startedAt.toISOString(),
          messageCount: g.messages.length,
          messages: g.messages.map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
        };
      })
      .reverse();

    res.json(
      GetStudentHistoryResponse.parse({
        studentVidyaId: student.vidyaId,
        name: student.name,
        sessions,
      }),
    );
  },
);

// ── Topic-mastery test results for a linked student ─────────────────
router.get(
  "/parent/:vidyaId/students/:studentVidyaId/assessments",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentAssessmentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const student = await getLinkedStudent(params.data.vidyaId, params.data.studentVidyaId);
    if (!student) {
      res.status(403).json({ error: "This student is not linked to your account." });
      return;
    }

    const rows = await db
      .select()
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.studentVidyaId, student.vidyaId),
          eq(assessmentsTable.status, "completed"),
        ),
      )
      .orderBy(desc(assessmentsTable.completedAt));

    res.json(
      GetStudentAssessmentsResponse.parse({
        results: rows.map((r) => ({
          testId: r.testId,
          topic: r.topic,
          topicLabel: r.topicLabel,
          totalQuestions: r.totalQuestions,
          correctCount: r.correctCount ?? 0,
          score: r.score ?? 0,
          maxScore: r.totalQuestions * r.pointsPerCorrect,
          completedAt: (r.completedAt ?? r.createdAt).toISOString(),
        })),
      }),
    );
  },
);

// ── Recommended next lesson(s) ──────────────────────────────────────
router.get(
  "/parent/:vidyaId/students/:studentVidyaId/recommendation",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetStudentRecommendationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const student = await getLinkedStudent(params.data.vidyaId, params.data.studentVidyaId);
    if (!student) {
      res.status(403).json({ error: "This student is not linked to your account." });
      return;
    }

    // 1. Practice activity per topic, across ALL detected topics.
    const messageRows = await db
      .select({ content: chatMessagesTable.content })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.studentVidyaId, student.vidyaId),
          eq(chatMessagesTable.role, "user"),
        ),
      );

    const topicCounts = new Map<string, number>();
    for (const row of messageRows) {
      const topic = detectTopic(row.content);
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }

    // 2. Best graded-test percentage per topic (a stronger mastery signal).
    const assessmentRows = await db
      .select({
        topic: assessmentsTable.topic,
        score: assessmentsTable.score,
        totalQuestions: assessmentsTable.totalQuestions,
        pointsPerCorrect: assessmentsTable.pointsPerCorrect,
      })
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.studentVidyaId, student.vidyaId),
          eq(assessmentsTable.status, "completed"),
        ),
      );

    const assessmentPctByTopic = new Map<string, number>();
    for (const r of assessmentRows) {
      const maxScore = r.totalQuestions * r.pointsPerCorrect;
      if (maxScore <= 0) continue;
      const pct = Math.round(((r.score ?? 0) / maxScore) * 100);
      const prev = assessmentPctByTopic.get(r.topic);
      if (prev === undefined || pct > prev) assessmentPctByTopic.set(r.topic, pct);
    }

    const { recommendations, allMastered } = recommendNextLessons(
      student.studentClass,
      topicCounts,
      assessmentPctByTopic,
    );

    res.json(
      GetStudentRecommendationResponse.parse({
        studentVidyaId: student.vidyaId,
        name: student.name,
        studentClass: student.studentClass ?? null,
        allMastered,
        recommendations,
      }),
    );
  },
);

// ── Ask Strategy AI: load saved conversation ────────────────────────
router.get(
  "/parent/:vidyaId/consultant/messages",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetConsultantHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(parentChatMessagesTable)
      .where(eq(parentChatMessagesTable.parentVidyaId, params.data.vidyaId))
      .orderBy(asc(parentChatMessagesTable.createdAt));

    const sessionId = rows.length > 0 ? rows[rows.length - 1].sessionId : randomUUID();

    res.json(
      GetConsultantHistoryResponse.parse({
        sessionId,
        messages: rows.map((r) => ({
          role: r.role === "assistant" ? "assistant" : "user",
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          attachmentName: r.attachmentName ?? null,
          attachmentType: r.attachmentType ?? null,
        })),
      }),
    );
  },
);

// ── Ask Strategy AI: list past conversations ────────────────────────
router.get(
  "/parent/:vidyaId/consultant/sessions",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = ListConsultantSessionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select({
        sessionId: parentChatMessagesTable.sessionId,
        role: parentChatMessagesTable.role,
        content: parentChatMessagesTable.content,
        createdAt: parentChatMessagesTable.createdAt,
      })
      .from(parentChatMessagesTable)
      .where(eq(parentChatMessagesTable.parentVidyaId, params.data.vidyaId))
      .orderBy(asc(parentChatMessagesTable.createdAt));

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
      // Preview = the first parent (user) message in the conversation.
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

    res.json(ListConsultantSessionsResponse.parse({ sessions }));
  },
);

// ── Ask Strategy AI: load one past conversation ─────────────────────
router.get(
  "/parent/:vidyaId/consultant/sessions/:sessionId/messages",
  requireAuth,
  requireSelf,
  async (req, res): Promise<void> => {
    const params = GetConsultantSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select()
      .from(parentChatMessagesTable)
      .where(
        and(
          eq(parentChatMessagesTable.parentVidyaId, params.data.vidyaId),
          eq(parentChatMessagesTable.sessionId, params.data.sessionId),
        ),
      )
      .orderBy(asc(parentChatMessagesTable.createdAt));

    res.json(
      GetConsultantSessionResponse.parse({
        sessionId: params.data.sessionId,
        messages: rows.map((r) => ({
          role: r.role === "assistant" ? "assistant" : "user",
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          attachmentName: r.attachmentName ?? null,
          attachmentType: r.attachmentType ?? null,
        })),
      }),
    );
  },
);

// ── Ask Strategy AI: transcribe recorded audio ──────────────────────
router.post(
  "/parent/:vidyaId/consultant/transcribe",
  requireAuth,
  requireSelf,
  rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "parent-transcribe" }),
  async (req, res): Promise<void> => {
    const params = TranscribeConsultantAudioParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = TranscribeConsultantAudioBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const { audio } = body.data;
    if (typeof audio !== "string" || !audio.startsWith("data:")) {
      res.status(400).json({ error: "That recording didn't upload correctly. Please try again." });
      return;
    }
    if (audio.length > MAX_AUDIO_DATAURL_LEN) {
      res.status(400).json({ error: "That recording is too long. Please keep it under a minute." });
      return;
    }

    const idx = audio.indexOf("base64,");
    if (idx === -1) {
      res.status(400).json({ error: "That recording didn't upload correctly. Please try again." });
      return;
    }

    try {
      const raw = Buffer.from(audio.slice(idx + 7), "base64");
      const { buffer, format } = await ensureCompatibleFormat(raw);
      const text = await speechToText(buffer, format);
      res.json(TranscribeConsultantAudioResponse.parse({ text: text.trim() }));
    } catch (err) {
      req.log.error({ err }, "parent audio transcription failed");
      res.status(500).json({ error: "Sorry, I couldn't understand that recording. Please try again." });
    }
  },
);

// ── Ask Strategy AI: streamed counselor reply ───────────────────────
router.post(
  "/parent/:vidyaId/consultant/message",
  requireAuth,
  requireSelf,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "parent-consult-minute" }),
  rateLimit({
    windowMs: 60 * 60_000,
    max: 200,
    keyPrefix: "parent-consult-hour",
    message: "You've asked a lot of questions today. Please take a break and come back in a little while.",
  }),
  async (req, res): Promise<void> => {
    const params = SendConsultantMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SendConsultantMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const parentVidyaId = req.vidyaId as string;
    const message = (parsed.data.message ?? "").trim();
    const attachment = parsed.data.attachment;

    if (!message && !attachment) {
      res.status(400).json({ error: "Please type a question or attach a file." });
      return;
    }
    if (message.length > MAX_MESSAGE_LEN) {
      res.status(400).json({ error: "That message is a bit too long — please shorten it." });
      return;
    }
    if (attachment) {
      if (typeof attachment.dataUrl !== "string" || !attachment.dataUrl.startsWith("data:")) {
        res.status(400).json({ error: "That file didn't upload correctly. Please try again." });
        return;
      }
      if (attachment.dataUrl.length > MAX_ATTACHMENT_DATAURL_LEN) {
        res.status(400).json({ error: "That file is a bit too big. Please attach something under ~8 MB." });
        return;
      }
    }

    const language = normalizeLanguage(parsed.data.language);

    const [parent] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vidyaId, parentVidyaId));
    if (!parent) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // If a child is referenced, verify the link and pull their analytics so the
    // counselor's advice is grounded in real activity data.
    let studentSummary: {
      name: string;
      studentClass: string | null;
      board: string | null;
      totalSessions: number;
      totalMessages: number;
      topics: CounselorTopicSummary[];
    } | null = null;
    let linkedStudentVidyaId: string | null = null;

    const requestedStudent = parsed.data.studentVidyaId?.trim();
    if (requestedStudent) {
      const student = await getLinkedStudent(parentVidyaId, requestedStudent);
      if (!student) {
        res.status(403).json({ error: "This student is not linked to your account." });
        return;
      }
      linkedStudentVidyaId = student.vidyaId;
      const rows = await db
        .select({
          sessionId: chatMessagesTable.sessionId,
          content: chatMessagesTable.content,
        })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.studentVidyaId, student.vidyaId),
            eq(chatMessagesTable.role, "user"),
          ),
        );
      const allSessions = new Set<string>();
      const counts = new Map<string, number>();
      for (const row of rows) {
        allSessions.add(row.sessionId);
        const topic = detectTopic(row.content);
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
      studentSummary = {
        name: student.name,
        studentClass: student.studentClass ?? null,
        board: student.board ?? null,
        totalSessions: allSessions.size,
        totalMessages: rows.length,
        topics: ANALYTICS_TOPICS.map((t) => {
          const count = counts.get(t.key) ?? 0;
          return {
            label: t.label,
            questionsPracticed: count,
            mastery: Math.min(100, Math.round(count * 12.5)),
          };
        }),
      };
    }

    const sessionId = parsed.data.sessionId?.slice(0, 100) || randomUUID();

    const history = (parsed.data.history ?? [])
      .slice(-MAX_HISTORY_ENTRIES)
      .map((h) => ({
        role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: h.content.slice(0, MAX_HISTORY_ENTRY_LEN),
      }));

    // Persist the parent's turn (append-only), noting any attachment by name.
    const loggedUser = attachment
      ? `${message}${message ? "\n" : ""}[Attached ${attachment.mimeType.startsWith("image/") ? "image" : "file"}: ${attachment.name}]`
      : message;
    try {
      await db.insert(parentChatMessagesTable).values({
        parentVidyaId,
        sessionId,
        studentVidyaId: linkedStudentVidyaId,
        role: "user",
        content: loggedUser,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.mimeType ?? null,
      });
    } catch (err) {
      req.log.error({ err }, "failed to persist parent consultant message");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (obj: unknown): void => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    let userText: string;
    let image: ChatImage | null = null;
    if (attachment && attachment.mimeType.startsWith("image/")) {
      userText = message || "I've attached an image. Please take a look and advise me.";
      image = { mimeType: attachment.mimeType, dataUrl: attachment.dataUrl };
    } else if (attachment) {
      const fileText = decodeTextAttachment(attachment.mimeType, attachment.dataUrl);
      userText = fileText
        ? `${message || "Please look at this file and advise me."}\n\n[The parent attached a file named "${attachment.name}". Its contents are:]\n${fileText}`
        : `${message || "I tried to attach a file."}\n\n[The parent attached a file named "${attachment.name}" (type ${attachment.mimeType}) that can't be read here. Acknowledge it and ask them to describe it or paste the text.]`;
    } else {
      userText = message;
    }

    const chatModel = normalizeChatModel(parsed.data.chatModel);
    const imageModel = normalizeImageModel(parsed.data.imageModel);

    // The counselor may append a `[[DRAW: ...]]` marker at the very end to
    // request an illustration. We stream conversational text as it arrives but
    // withhold any trailing run that could still grow into the marker so it
    // never leaks to the parent/tutor.
    let full = "";
    let sent = 0;
    let imagePrompt: string | null = null;
    let fallbackText: string | null = null;

    const streamFlush = (): void => {
      const idx = full.indexOf(DRAW_MARKER_START);
      let safeEnd: number;
      if (idx !== -1) {
        safeEnd = idx;
      } else {
        // Withhold the longest suffix of `full` that is a prefix of the marker.
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

    try {
      const stream = streamChat({
        provider: chatModel.provider,
        model: chatModel.model,
        system: buildCounselorSystemPrompt({
          parentName: parent.name,
          language,
          aboutMe: parent.aboutMe ?? null,
          role: parent.role === "tutor" ? "tutor" : "parent",
          student: studentSummary,
        }),
        history,
        userText,
        image,
      });
      for await (const delta of stream) {
        full += delta;
        streamFlush();
      }

      const drawMatch = full.match(DRAW_MARKER_RE);
      const visibleEnd = drawMatch ? (drawMatch.index ?? full.length) : full.length;
      if (drawMatch) imagePrompt = drawMatch[1].trim();
      if (visibleEnd > sent) {
        send({ chunk: full.slice(sent, visibleEnd) });
        sent = visibleEnd;
      }
    } catch (err) {
      req.log.error({ err }, "parent consultant completion failed");
      if (sent === 0) {
        fallbackText = "Sorry, I had trouble answering just now. Please try asking again.";
        send({ chunk: fallbackText });
      }
    }

    if (imagePrompt) {
      send({ drawing: true });
      try {
        const dataUrl = await generateImageDataUrl(
          imageModel,
          [
            "Create ONE clear, accurate educational maths diagram or illustration for explaining a concept to a parent/tutor of a primary-school child (ages 9–13).",
            "Draw EXACTLY and ONLY what the description says, with correct quantities, groupings, proportions and labels. The diagram must be mathematically correct.",
            "Do NOT add extra, decorative or unrelated objects, cartoon characters, mascots, busy backgrounds, or scenery — only the maths concept being illustrated.",
            "Style: clean flat vector, bright friendly colours, bold simple shapes, large clear labels, plain white background. Keep any text very short and spelled correctly.",
            "",
            `Diagram to draw: ${imagePrompt}`,
          ].join("\n"),
        );
        send({ image: dataUrl, imageAlt: imagePrompt });
      } catch (err) {
        req.log.error({ err }, "parent consultant image generation failed");
        send({ imageError: true });
      }
    }

    // Persist exactly what was safely streamed to the client: `sent` already
    // excludes the [[DRAW]] marker (and any withheld partial-marker suffix), so
    // no marker text can leak into saved history even if the stream errored
    // mid-marker. Falls back to the error message actually shown.
    const assistantText = full.slice(0, sent).trim() || (fallbackText ?? "");
    if (assistantText) {
      try {
        await db.insert(parentChatMessagesTable).values({
          parentVidyaId,
          sessionId,
          studentVidyaId: linkedStudentVidyaId,
          role: "assistant",
          content: assistantText,
        });
      } catch (err) {
        req.log.error({ err }, "failed to persist parent consultant reply");
      }
    }

    send({ done: true, sessionId });
    res.end();
  },
);

export default router;
