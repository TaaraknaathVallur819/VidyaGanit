import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

import { BADGE_CATALOG } from "@/lib/badges";
import { useLanguage } from "@/lib/i18n";
import MiniGames from "@/components/MiniGames";
import AiModelSelect, { type ChatProvider } from "@/components/AiModelSelect";
import ImageModelSelect, { type ImageModel } from "@/components/ImageModelSelect";

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
  const [isListening, setIsListening] = useState(false);
  const [provider, setProvider] = useState<ChatProvider>("openai");
  const [imageModel, setImageModel] = useState<ImageModel>("openai");
  const [gameOffered, setGameOffered] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputBeforeVoiceRef = useRef<string>("");

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

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      return;
    }
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setAttachError(t("chat.err.voiceUnsupported"));
      return;
    }
    setAttachError(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    inputBeforeVoiceRef.current = input ? input.trim() + " " : "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(inputBeforeVoiceRef.current + transcript);
      requestAnimationFrame(adjustTextarea);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setAttachError(t("chat.err.micPermission"));
      } else if (event.error === "no-speech") {
        setAttachError(t("chat.err.noSpeech"));
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setAttachError(t("chat.err.micStart"));
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

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
          provider,
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
            };

            if (data.game) {
              setGameOffered(true);
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
                  m.id === tutorMsgId ? { ...m, isStreaming: false } : m,
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
        <AiModelSelect value={provider} onChange={setProvider} disabled={isStreaming} />
        <ImageModelSelect value={imageModel} onChange={setImageModel} disabled={isStreaming} />
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
                <TutorBubble
                  content={msg.content}
                  isStreaming={msg.isStreaming}
                  isDrawing={msg.isDrawing}
                  imageUrl={msg.imageUrl}
                  imageAlt={msg.imageAlt}
                  drawingLabel={t("chat.drawing")}
                />
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
          <button
            type="button"
            data-testid="button-play-game-offer"
            onClick={() => {
              setGamesOpen(true);
              setGameOffered(false);
            }}
            className="mb-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Gamepad2 className="w-4 h-4" />
            {t("games.offer")}
          </button>
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
        onClose={() => setGamesOpen(false)}
        vidyaId={vidyaId}
        onXpAwarded={onXpAwarded}
      />
    </div>
  );
}
