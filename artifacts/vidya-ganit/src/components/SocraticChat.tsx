import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Camera, Paperclip, SendHorizonal, RefreshCw, Zap } from "lucide-react";

export const BADGE_CATALOG: { id: string; emoji: string; name: string }[] = [
  { id: "first_step", emoji: "🌟", name: "First Step" },
  { id: "fraction_friend", emoji: "🍕", name: "Fraction Friend" },
  { id: "cricket_scholar", emoji: "🏏", name: "Cricket Scholar" },
  { id: "geometry_genius", emoji: "📐", name: "Geometry Genius" },
  { id: "algebra_ace", emoji: "🧮", name: "Algebra Ace" },
  { id: "hot_streak", emoji: "🔥", name: "Hot Streak" },
  { id: "never_give_up", emoji: "💪", name: "Never Give Up" },
  { id: "century_club", emoji: "🏆", name: "Century Club" },
];

type Message = {
  id: string;
  role: "user" | "tutor";
  content: string;
  isStreaming?: boolean;
};

type HistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

type XpToast = { id: string; amount: number };
type BadgeToast = { id: string; emoji: string; name: string };

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
}: {
  content: string;
  isStreaming?: boolean;
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
          isStreaming && <TypingDots />
        )}
        {isStreaming && content && (
          <span className="inline-block w-0.5 h-[14px] bg-white/60 ml-0.5 animate-pulse align-middle rounded-full" />
        )}
      </div>
    </div>
  );
}

function StudentBubble({
  content,
  initial,
}: {
  content: string;
  initial: string;
}) {
  return (
    <div className="flex items-start gap-2.5 max-w-[88%] ml-auto flex-row-reverse">
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm mt-0.5 select-none">
        {initial}
      </div>
      <div className="bg-white text-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm border border-indigo-100 max-w-full">
        <span className="whitespace-pre-wrap break-words">{content}</span>
      </div>
    </div>
  );
}

const WELCOME = (name: string, cls: string | null, board: string | null) => {
  const fn = name.split(" ")[0];
  const info = [cls ? `Class ${cls}` : "", board ?? ""].filter(Boolean).join(" · ");
  return (
    `Hey ${fn}! 👋 I'm your VidyaGanit Maths Tutor! 🚀\n\n` +
    `I won't hand you answers directly — but I WILL help you discover them yourself. ` +
    `That makes them stick in your brain forever! 🧠✨\n\n` +
    (info ? `I know your ${info} syllabus really well. ` : "") +
    `Ask me any maths challenge — fractions, multiplication, geometry, percentages, equations — anything!\n\n` +
    `Every question earns you XP and badges too! 🌟 What shall we tackle first?`
  );
};

export default function SocraticChat({
  vidyaId,
  studentName,
  studentClass,
  board,
  onXpAwarded,
}: Props) {
  const fn = studentName.split(" ")[0];
  const initial = fn[0]?.toUpperCase() ?? "S";

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsgId = `u-${Date.now()}`;
    const tutorMsgId = `t-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: msg },
      { id: tutorMsgId, role: "tutor", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vidyaId, message: msg, history }),
      });

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
            };

            if (typeof data.chunk === "string") {
              fullContent += data.chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tutorMsgId ? { ...m, content: fullContent } : m,
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
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tutorMsgId
            ? {
                ...m,
                content:
                  "Oops! I had trouble connecting. 😅 Please try again!",
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
  };

  const quickStarters = [
    "What are fractions? 🍕",
    "Help me multiply large numbers 🏏",
    "How do I find the area? 📐",
    "What are percentages? 🌟",
  ];

  return (
    <div className="relative flex flex-col h-full bg-[#F5F0FF]">
      {/* Chat header */}
      <div className="px-4 py-3 bg-white border-b border-indigo-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg select-none shadow-sm">
          🚀
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">VidyaGanit Tutor</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              Socratic Mode
              {studentClass ? ` · Class ${studentClass}` : ""}
              {board ? ` · ${board}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear chat"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        <TutorBubble content={WELCOME(studentName, studentClass, board)} />

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === "user" ? (
                <StudentBubble content={msg.content} initial={initial} />
              ) : (
                <TutorBubble content={msg.content} isStreaming={msg.isStreaming} />
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
              Try one of these to get started 👇
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
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <div className="flex items-center gap-0.5 pb-0.5">
            <button
              type="button"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors"
              title="Camera"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors"
              title="Voice"
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
            placeholder="Type your maths question… (Enter to send)"
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[38px] max-h-[120px] py-1.5 leading-relaxed"
            rows={1}
            disabled={isStreaming}
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shadow-sm shrink-0 mb-0.5"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5 select-none">
          Enter → send &nbsp;·&nbsp; Shift+Enter → new line &nbsp;·&nbsp; Every question earns XP! 🌟
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
                  🎉 Badge Unlocked!
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {toast.name}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
