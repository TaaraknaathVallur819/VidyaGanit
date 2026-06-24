import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Camera,
  Paperclip,
  SendHorizonal,
  RefreshCw,
  Zap,
  FileText,
  X,
  Gamepad2,
  History,
  Loader2,
  MessageSquare,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

import {
  useListChatSessions,
  getListChatSessionsQueryKey,
  getChatSession,
  setChatMessageFeedback,
} from "@workspace/api-client-react";
import { BADGE_CATALOG } from "@/lib/badges";
import { gameForTopicOrDefault } from "@/lib/syllabus";
import { type GameId } from "@/lib/games";
import { useLanguage } from "@/lib/i18n";
import { useLiveSpeech } from "@/hooks/useLiveSpeech";
import MiniGames from "@/components/MiniGames";
import AssessmentTest from "@/components/AssessmentTest";
import AiModelSelect, { type ChatModelKey } from "@/components/AiModelSelect";
import ImageModelSelect, { type ImageModel } from "@/components/ImageModelSelect";
import SpeakButton from "@/components/SpeakButton";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB

type Attachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
  isImage: boolean;
};

type Message = {
  id: string;
  role: "user" | "tutor";
  content: string;
  isStreaming?: boolean;
  isDrawing?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  attachment?: Attachment;
  dbId?: number;
  feedback?: "up" | "down" | null;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

class ChatError extends Error {}

type HistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

type XpToast = { id: string; amount: number };
type BadgeToast = { id: string; emoji: string; name: string };

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

/**
 * Frontend gatekeeper for child input. Returns a friendly nudge string when the
 * message is pure gibberish or emoji spam, otherwise null (safe to send).
 */
function validateStudentInput(msg: string): string | null {
  const emojiCount = (msg.match(EMOJI_RE) ?? []).length;
  const withoutEmoji = msg.replace(EMOJI_RE, "");
  // Unicode-aware: accept any script's letters/numbers (Hindi, Tamil, etc.)
  // or common maths operators. Only pure punctuation/symbols count as "no meaning".
  const hasMeaning =
    /[\p{L}\p{N}]/u.test(withoutEmoji) || /[+\-×÷*/=%<>]/.test(withoutEmoji);

  if (!hasMeaning) {
    return "chat.err.noMeaning";
  }
  if (emojiCount >= 6) {
    return "chat.err.tooManyEmojis";
  }
  if (/([a-zA-Z])\1{7,}/.test(msg) || /([!?.,@#%^&*~])\1{5,}/.test(msg)) {
    return "chat.err.keyboardWiggle";
  }
  const looksMashed = msg
    .split(/\s+/)
    .some((w) => w.length >= 15 && /^[a-z]+$/i.test(w) && !/[aeiou]/i.test(w));
  if (looksMashed) {
    return "chat.err.jumbled";
  }
  return null;
}

type Props = {
  vidyaId: string;
  studentName: string;
  studentClass: string | null;
  board: string | null;
  onXpAwarded?: () => void;
};

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-white/70 animate-bounce"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

function TutorBubble({
  content,
  isStreaming,
  isDrawing,
  imageUrl,
  imageAlt,
  drawingLabel,
}: {
  content: string;
  isStreaming?: boolean;
  isDrawing?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  drawingLabel: string;
}) {
  return (
    <div className="flex items-start gap-2.5 max-w-[88%]">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base shrink-0 shadow-sm mt-0.5 select-none">
        🚀
      </div>
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-md max-w-full">
        {content ? (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        ) : (
          isStreaming && !isDrawing && <TypingDots />
        )}
        {isStreaming && content && !isDrawing && (
          <span className="inline-block w-0.5 h-[14px] bg-white/60 ml-0.5 animate-pulse align-middle rounded-full" />
        )}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt ?? "Illustration"}
            className="mt-2.5 rounded-xl w-full max-w-[280px] bg-white shadow-sm"
          />
        )}
        {isDrawing && !imageUrl && (
          <div className="mt-2.5 flex items-center gap-2 text-white/90 text-xs">
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span>{drawingLabel}</span>
          </div>
        )}
        {!isStreaming && !isDrawing && content && (
          <div className="mt-1.5 -mb-1 -ml-1">
            <SpeakButton text={content} tone="light" />
          </div>
        )}
      </div>
    </div>
  );
}

function StudentBubble({
  content,
  initial,
  attachment,
}: {
  content: string;
  initial: string;
  attachment?: Attachment;
}) {
  return (
    <div className="flex items-start gap-2.5 max-w-[88%] ml-auto flex-row-reverse">
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm mt-0.5 select-none">
        {initial}
      </div>
      <div className="bg-white text-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm border border-indigo-100 max-w-full">
        {attachment &&
          (attachment.isImage ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="mb-2 rounded-xl w-full max-w-[240px] border border-indigo-100"
            />
          ) : (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 max-w-[240px]">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">
                {attachment.name}
              </span>
            </div>
          ))}
        {content && (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        )}
      </div>
    </div>
  );
}

const buildWelcome = (
  t: (key: string) => string,
  name: string,
  cls: string | null,
  board: string | null,
) => {
  const fn = name.split(" ")[0];
  const info = [cls ? `${t("common.class")} ${cls}` : "", board ?? ""]
    .filter(Boolean)
    .join(" · ");
  const syllabus = info
    ? t("chat.welcomeSyllabus").replace("{info}", info)
    : "";
  return t("chat.welcome").replace("{name}", fn).replace("{info}", syllabus);
};

export default function SocraticChat({
  vidyaId,
  studentName,
  studentClass,
  board,
  onXpAwarded,
}: Props) {
  const { t, lang } = useLanguage();
  const fn = studentName.split(" ")[0];
  const initial = fn[0]?.toUpperCase() ?? "S";

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState<ChatModelKey>("gpt-5-mini");
  const [imageModel, setImageModel] = useState<ImageModel>("gemini-nano-banana");
  const [gameOffered, setGameOffered] = useState(false);
  const [gameTopic, setGameTopic] = useState<string | null>(null);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [initialGame, setInitialGame] = useState<GameId | null>(null);
  const [testOffer, setTestOffer] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testTopic, setTestTopic] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputBeforeVoiceRef = useRef<string>("");

  // List the student's own past tutoring conversations.
  const { data: sessionsData, refetch: refetchSessions } = useListChatSessions(
    vidyaId,
    {
      query: {
        enabled: !!vidyaId,
        queryKey: getListChatSessionsQueryKey(vidyaId),
        staleTime: 0,
      },
    },
  );
  const sessions = sessionsData?.sessions ?? [];

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (isStreaming || loadingSessionId) return;
      if (sessionId === activeSessionId) {
        setShowHistory(false);
        return;
      }
      setLoadingSessionId(sessionId);
      try {
        const data = await getChatSession(vidyaId, sessionId);
        sessionIdRef.current = data.sessionId;
        setActiveSessionId(data.sessionId);
        setMessages(
          data.messages.map((m, i) => ({
            id: `saved-${data.sessionId}-${i}`,
            role: m.role === "assistant" ? "tutor" : "user",
            content: m.content,
            dbId: m.id,
            feedback: m.feedback ?? null,
          })),
        );
        setHistory(
          data.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        );
        setInput("");
        setAttachment(null);
        setGameOffered(false);
        setTestOffer(null);
        setShowHistory(false);
      } catch {
        setAttachError(t("chat.err.connect"));
      } finally {
        setLoadingSessionId(null);
      }
    },
    [vidyaId, isStreaming, loadingSessionId, activeSessionId, t],
  );

  const formatSessionDate = (value: Date | string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleFeedback = useCallback(
    async (target: Message, value: "up" | "down") => {
      if (target.dbId == null) return;
      const prevFeedback = target.feedback ?? null;
      const next = prevFeedback === value ? null : value;
      setMessages((prev) =>
        prev.map((m) => (m.id === target.id ? { ...m, feedback: next } : m)),
      );
      try {
        await setChatMessageFeedback(vidyaId, target.dbId, { feedback: next });
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === target.id ? { ...m, feedback: prevFeedback } : m,
          ),
        );
      }
    },
    [vidyaId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  const showXpToast = (amount: number) => {
    const id = `xp-${Date.now()}`;
    setXpToasts((prev) => [...prev, { id, amount }]);
    setTimeout(() => setXpToasts((prev) => prev.filter((t) => t.id !== id)), 2200);
  };

  const showBadgeToast = (emoji: string, name: string) => {
    const id = `badge-${Date.now()}-${name}`;
    setBadgeToasts((prev) => [...prev, { id, emoji, name }]);
    setTimeout(
      () => setBadgeToasts((prev) => prev.filter((t) => t.id !== id)),
      3800,
    );
  };

  const { isListening, start: startListening, stop: stopListening } = useLiveSpeech({
    lang,
    onResult: (transcript) => {
      setInput(inputBeforeVoiceRef.current + transcript);
      requestAnimationFrame(adjustTextarea);
    },
    onError: (kind) => {
      if (kind === "permission") setAttachError(t("chat.err.micPermission"));
      else if (kind === "no-speech") setAttachError(t("chat.err.noSpeech"));
      else if (kind === "unsupported")
        setAttachError(t("chat.err.voiceUnsupported"));
      else setAttachError(t("chat.err.micStart"));
    },
  });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      return;
    }
    setAttachError(null);
    inputBeforeVoiceRef.current = input ? input.trim() + " " : "";
    startListening();
  };

  const handleFilePicked = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setAttachError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(t("chat.err.fileTooBig"));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachment({
        name: file.name || "attachment",
        mimeType: file.type || "application/octet-stream",
        dataUrl,
        isImage: file.type.startsWith("image/"),
      });
    } catch {
      setAttachError(t("chat.err.fileUnreadable"));
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    const currentAttachment = attachment;
    if ((!msg && !currentAttachment) || isStreaming) return;

    // Only gibberish-check typed text; an attachment is meaningful on its own.
    if (msg && !currentAttachment) {
      const validationErrorKey = validateStudentInput(msg);
      if (validationErrorKey) {
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: "user", content: msg },
          { id: `t-${Date.now()}`, role: "tutor", content: t(validationErrorKey) },
        ]);
        return;
      }
    }

    setInput("");
    setAttachment(null);
    setAttachError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsgId = `u-${Date.now()}`;
    const tutorMsgId = `t-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: msg,
        attachment: currentAttachment ?? undefined,
      },
      { id: tutorMsgId, role: "tutor", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vidyaId,
          message: msg,
          sessionId: sessionIdRef.current,
          history,
          language: lang,
          chatModel,
          imageModel,
          ...(currentAttachment
            ? {
                attachment: {
                  name: currentAttachment.name,
                  mimeType: currentAttachment.mimeType,
                  dataUrl: currentAttachment.dataUrl,
                },
              }
            : {}),
        }),
      });

      if (response.status === 401) {
        throw new ChatError(t("chat.err.loginAgain"));
      }
      if (response.status === 429) {
        let msg429 = t("chat.err.rateLimit");
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) msg429 = body.error;
        } catch {
          // keep default message
        }
        throw new ChatError(msg429);
      }
      if (!response.ok || !response.body) throw new Error("Request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              chunk?: string;
              done?: boolean;
              xpAwarded?: number;
              newBadges?: string[];
              drawing?: boolean;
              image?: string;
              imageAlt?: string;
              imageError?: boolean;
              game?: boolean;
              test?: boolean;
              topic?: string;
              messageId?: number | null;
            };

            if (data.game) {
              setGameOffered(true);
              setGameTopic(data.topic ?? null);
            }

            if (data.test) {
              setTestOffer(data.topic ?? "fraction");
            }

            if (typeof data.chunk === "string") {
              fullContent += data.chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId ? { ...m, content: fullContent } : m,
                ),
              );
            }

            if (data.drawing) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId ? { ...m, isDrawing: true } : m,
                ),
              );
            }

            if (typeof data.image === "string") {
              const imageUrl = data.image;
              const imageAlt = data.imageAlt;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId
                    ? { ...m, isDrawing: false, imageUrl, imageAlt }
                    : m,
                ),
              );
            }

            if (data.imageError) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId ? { ...m, isDrawing: false } : m,
                ),
              );
            }

            if (data.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId
                    ? {
                        ...m,
                        isStreaming: false,
                        dbId:
                          typeof data.messageId === "number"
                            ? data.messageId
                            : m.dbId,
                      }
                    : m,
                ),
              );
              setHistory((prev) => [
                ...prev,
                { role: "user", content: msg },
                { role: "assistant", content: fullContent },
              ]);

              if (data.xpAwarded) {
                showXpToast(data.xpAwarded);
                onXpAwarded?.();
              }
              if (data.newBadges?.length) {
                data.newBadges.forEach((badgeId) => {
                  const def = BADGE_CATALOG.find((b) => b.id === badgeId);
                  if (def) showBadgeToast(def.emoji, def.name);
                });
              }

              setActiveSessionId(sessionIdRef.current);
              void refetchSessions();
              setIsStreaming(false);
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (err) {
      const friendly =
        err instanceof ChatError ? err.message : t("chat.err.connect");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tutorMsgId
            ? {
                ...m,
                content: friendly,
                isStreaming: false,
              }
            : m,
        ),
      );
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setHistory([]);
    setInput("");
    setAttachment(null);
    setAttachError(null);
    setGameOffered(false);
    setTestOffer(null);
    setActiveSessionId(null);
    setShowHistory(false);
    sessionIdRef.current = crypto.randomUUID();
  };

  const quickStarters = [
    t("chat.quick.fractions"),
    t("chat.quick.multiply"),
    t("chat.quick.area"),
    t("chat.quick.percentages"),
  ];

  return (
    <div className="relative flex flex-col h-full bg-[#F5F0FF]">
      {/* Chat header */}
      <div className="px-4 py-3 bg-white border-b border-indigo-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg select-none shadow-sm">
          🚀
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{t("chat.tutorName")}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {t("chat.socraticMode")}
              {studentClass ? ` · ${t("common.class")} ${studentClass}` : ""}
              {board ? ` · ${board}` : ""}
            </p>
          </div>
        </div>
        <AiModelSelect value={chatModel} onChange={setChatModel} disabled={isStreaming} />
        <ImageModelSelect value={imageModel} onChange={setImageModel} disabled={isStreaming} />
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-label={t("strategy.history")}
          aria-pressed={showHistory}
          className={`p-1.5 rounded-lg transition-colors ${
            showHistory
              ? "bg-indigo-50 text-primary"
              : "text-muted-foreground hover:text-primary hover:bg-indigo-50"
          }`}
          title={t("strategy.history")}
        >
          <History className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("chat.clearChat")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Past conversations panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-indigo-100 bg-indigo-50/40 overflow-hidden shrink-0"
          >
            <div className="max-h-56 overflow-y-auto p-2">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  {t("strategy.noSessions")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {sessions.map((s) => (
                    <li key={s.sessionId}>
                      <button
                        type="button"
                        onClick={() => void loadSession(s.sessionId)}
                        disabled={!!loadingSessionId || isStreaming}
                        className={`w-full text-left flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors disabled:opacity-60 ${
                          s.sessionId === activeSessionId
                            ? "bg-white border border-indigo-200 shadow-sm"
                            : "hover:bg-white/70 border border-transparent"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                          {loadingSessionId === s.sessionId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {s.preview || t("chat.tutorName")}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatSessionDate(s.lastMessageAt)} ·{" "}
                            {t("strategy.messageCount").replace(
                              "{count}",
                              String(s.messageCount),
                            )}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        <TutorBubble
          content={buildWelcome(t, studentName, studentClass, board)}
          drawingLabel={t("chat.drawing")}
        />

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === "user" ? (
                <StudentBubble
                  content={msg.content}
                  initial={initial}
                  attachment={msg.attachment}
                />
              ) : (
                <div>
                  <TutorBubble
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                    isDrawing={msg.isDrawing}
                    imageUrl={msg.imageUrl}
                    imageAlt={msg.imageAlt}
                    drawingLabel={t("chat.drawing")}
                  />
                  {!msg.isStreaming && !msg.isDrawing && msg.dbId != null && (
                    <div className="flex items-center gap-1 mt-1.5 ml-[42px]">
                      <button
                        type="button"
                        aria-label={t("chat.feedback.helpful")}
                        aria-pressed={msg.feedback === "up"}
                        title={t("chat.feedback.helpful")}
                        onClick={() => handleFeedback(msg, "up")}
                        className={`p-1.5 rounded-lg transition-colors ${
                          msg.feedback === "up"
                            ? "bg-green-100 text-green-600"
                            : "text-green-500/70 hover:bg-green-50 hover:text-green-600"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("chat.feedback.notHelpful")}
                        aria-pressed={msg.feedback === "down"}
                        title={t("chat.feedback.notHelpful")}
                        onClick={() => handleFeedback(msg, "down")}
                        className={`p-1.5 rounded-lg transition-colors ${
                          msg.feedback === "down"
                            ? "bg-red-100 text-red-600"
                            : "text-red-500/70 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-2"
          >
            <p className="text-xs text-center text-muted-foreground font-medium mb-3">
              {t("chat.tryToStart")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickStarters.map((qs) => (
                <button
                  key={qs}
                  type="button"
                  onClick={() => sendMessage(qs)}
                  disabled={isStreaming}
                  className="text-left text-xs font-medium px-3 py-2.5 rounded-xl bg-white border border-indigo-100 text-foreground hover:border-primary hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-40"
                >
                  {qs}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 bg-white border-t border-indigo-100 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={handleFilePicked}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFilePicked}
        />

        {gameOffered && (
          <div
            data-testid="game-offer"
            className="mb-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3"
          >
            <p className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-amber-700">
              <Gamepad2 className="w-4 h-4" />
              {t("games.offer")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="button-play-game-yes"
                onClick={() => {
                  setInitialGame(
                    gameForTopicOrDefault(
                      gameTopic,
                      studentClass == null ? null : Number(studentClass),
                      board,
                    ),
                  );
                  setGamesOpen(true);
                  setGameOffered(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                <Gamepad2 className="w-4 h-4" />
                {t("games.offerYes")}
              </button>
              <button
                type="button"
                data-testid="button-play-game-no"
                onClick={() => setGameOffered(false)}
                className="flex-1 rounded-xl border-2 border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                {t("games.offerNo")}
              </button>
            </div>
          </div>
        )}

        {testOffer && (
          <div
            data-testid="test-offer"
            className="mb-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3"
          >
            <p className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-primary">
              <ClipboardCheck className="w-4 h-4" />
              {t("test.offer")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="button-take-test-yes"
                onClick={() => {
                  setTestTopic(testOffer);
                  setTestOpen(true);
                  setTestOffer(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                <ClipboardCheck className="w-4 h-4" />
                {t("test.offerYes")}
              </button>
              <button
                type="button"
                data-testid="button-take-test-no"
                onClick={() => setTestOffer(null)}
                className="flex-1 rounded-xl border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-primary hover:bg-indigo-100 transition-colors"
              >
                {t("test.offerNo")}
              </button>
            </div>
          </div>
        )}

        {attachment && (
          <div className="mb-2 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-2">
            {attachment.isImage ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="w-10 h-10 rounded-lg object-cover border border-indigo-100 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
            )}
            <span className="flex-1 text-xs font-medium text-foreground truncate">
              {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-white transition-colors shrink-0"
              title={t("chat.removeAttachment")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {attachError && (
          <p className="mb-2 text-[11px] font-medium text-red-500">{attachError}</p>
        )}

        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <div className="flex items-center gap-0.5 pb-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("chat.attachFile")}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isStreaming}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("chat.takePhoto")}
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleListening}
              disabled={isStreaming}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? "text-red-500 bg-red-50 animate-pulse"
                  : "text-muted-foreground hover:text-primary hover:bg-indigo-50"
              }`}
              title={isListening ? t("chat.stopListening") : t("chat.speak")}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming ? t("chat.calculating") : t("chat.placeholder")
            }
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[38px] max-h-[120px] py-1.5 leading-relaxed disabled:cursor-not-allowed"
            rows={1}
            disabled={isStreaming}
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !attachment) || isStreaming}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shadow-sm shrink-0 mb-0.5"
          >
            {isStreaming ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-center mt-1.5 select-none">
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5 justify-center text-primary font-semibold">
              <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              {t("chat.calculatingShort")}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t("chat.footerHint")}
            </span>
          )}
        </p>
      </div>

      {/* XP float toasts */}
      <AnimatePresence>
        {xpToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -70, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.9, ease: "easeOut" }}
            className="absolute bottom-[88px] right-5 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
              <Zap className="w-3.5 h-3.5" />
              +{toast.amount} XP
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Badge unlock toasts */}
      <AnimatePresence>
        {badgeToasts.map((toast, i) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute z-50"
            style={{ bottom: `${100 + i * 80}px`, left: "16px" }}
          >
            <div className="flex items-center gap-2.5 bg-white border-2 border-amber-300 rounded-xl px-3 py-2.5 shadow-xl max-w-[220px]">
              <span className="text-2xl shrink-0">{toast.emoji}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                  {t("chat.badgeUnlocked")}
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {toast.name}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <MiniGames
        open={gamesOpen}
        onClose={() => {
          setGamesOpen(false);
          setInitialGame(null);
        }}
        vidyaId={vidyaId}
        studentClass={studentClass}
        board={board}
        onXpAwarded={onXpAwarded}
        initialGame={initialGame}
      />

      <AssessmentTest
        open={testOpen}
        onClose={() => setTestOpen(false)}
        topic={testTopic}
        vidyaId={vidyaId}
        onCompleted={onXpAwarded}
      />
    </div>
  );
}
