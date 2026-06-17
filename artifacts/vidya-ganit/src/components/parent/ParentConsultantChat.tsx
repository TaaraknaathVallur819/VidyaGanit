import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Camera,
  Paperclip,
  SendHorizonal,
  FileText,
  X,
  Square,
  Loader2,
  Sparkles,
  UserRound,
  History,
  Plus,
  MessageSquare,
} from "lucide-react";
import {
  useListConsultantSessions,
  getListConsultantSessionsQueryKey,
  getConsultantSession,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import AiModelSelect, { type ChatProvider } from "@/components/AiModelSelect";
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
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  attachment?: Attachment;
  attachmentName?: string | null;
  attachmentType?: string | null;
};

type HistoryEntry = { role: "user" | "assistant"; content: string };

class ChatError extends Error {}

function readFileAsDataUrl(file: File | Blob, name = "file"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${name}`));
    reader.readAsDataURL(file);
  });
}

function pickAudioMime(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export default function ParentConsultantChat({
  vidyaId,
  parentName,
  selectedStudentId,
  selectedStudentName,
  variant = "parent",
}: {
  vidyaId: string;
  parentName: string;
  selectedStudentId: string | null;
  selectedStudentName: string | null;
  /** "parent" → Strategy AI counsellor; "coach" → tutor teaching coach. */
  variant?: "parent" | "coach";
}) {
  const { t, lang } = useLanguage();
  const isCoach = variant === "coach";
  const titleKey = isCoach ? "coach.title" : "strategy.title";
  const placeholderKey = isCoach ? "coach.placeholder" : "strategy.placeholder";
  const welcomeText = isCoach
    ? t("coach.welcome").replace("{name}", parentName)
    : t("strategy.welcome").replace("{parent}", parentName);

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [provider, setProvider] = useState<ChatProvider>("openai");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const streamAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // List the parent's past counseling conversations.
  const { data: sessionsData, refetch: refetchSessions } = useListConsultantSessions(
    vidyaId,
    {
      query: {
        enabled: !!vidyaId,
        queryKey: getListConsultantSessionsQueryKey(vidyaId),
        staleTime: 0,
      },
    },
  );

  const sessions = sessionsData?.sessions ?? [];

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId || loadingSessionId) {
        setShowHistory(false);
        return;
      }
      // Cancel any in-flight reply stream so it can't write into this session.
      streamAbortRef.current?.abort();
      setIsStreaming(false);
      setLoadingSessionId(sessionId);
      setStatusError(null);
      try {
        const data = await getConsultantSession(vidyaId, sessionId);
        sessionIdRef.current = data.sessionId;
        setActiveSessionId(data.sessionId);
        setMessages(
          data.messages.map((m, i) => ({
            id: `saved-${data.sessionId}-${i}`,
            role: m.role,
            content: m.content,
            attachmentName: m.attachmentName,
            attachmentType: m.attachmentType,
          })),
        );
        setHistory(data.messages.map((m) => ({ role: m.role, content: m.content })));
        setIsContinuing(data.messages.length > 0);
        setInput("");
        setAttachment(null);
        setShowHistory(false);
      } catch {
        setStatusError(t("strategy.error"));
      } finally {
        setLoadingSessionId(null);
      }
    },
    [vidyaId, activeSessionId, loadingSessionId, t],
  );

  // On first load, restore the most recent conversation (if any).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !sessionsData) return;
    restoredRef.current = true;
    const latest = sessionsData.sessions[0];
    if (latest) void loadSession(latest.sessionId);
  }, [sessionsData, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, []);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatusError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setStatusError(t("strategy.fileTooBig"));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, file.name);
      setAttachment({
        name: file.name || "attachment",
        mimeType: file.type || "application/octet-stream",
        dataUrl,
        isImage: file.type.startsWith("image/"),
      });
    } catch {
      setStatusError(t("strategy.error"));
    }
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      setIsTranscribing(true);
      setStatusError(null);
      try {
        const dataUrl = await readFileAsDataUrl(blob, "recording");
        const res = await fetch(`/api/parent/${vidyaId}/consultant/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ audio: dataUrl, mimeType, language: lang }),
        });
        if (!res.ok) throw new Error("transcription failed");
        const data = (await res.json()) as { text?: string };
        if (data.text) {
          setInput((prev) => (prev ? prev.trim() + " " : "") + data.text);
          requestAnimationFrame(adjustTextarea);
        }
      } catch {
        setStatusError(t("strategy.error"));
      } finally {
        setIsTranscribing(false);
      }
    },
    [vidyaId, lang, adjustTextarea, t],
  );

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    const mimeType = pickAudioMime();
    if (!mimeType || typeof navigator === "undefined" || !navigator.mediaDevices) {
      setStatusError(t("strategy.micUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        mediaRecorderRef.current = null;
        if (blob.size > 0) void transcribeBlob(blob, mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setStatusError(null);
    } catch {
      setStatusError(t("strategy.micUnsupported"));
    }
  }, [isRecording, stopRecording, transcribeBlob, t]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const sendMessage = async () => {
    const msg = input.trim();
    const currentAttachment = attachment;
    if ((!msg && !currentAttachment) || isStreaming) return;

    setInput("");
    setAttachment(null);
    setStatusError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsgId = `u-${Date.now()}`;
    const aiMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: msg,
        attachment: currentAttachment ?? undefined,
      },
      { id: aiMsgId, role: "assistant", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    // Capture the session this turn belongs to. If the user starts a new
    // conversation or switches sessions while this stream is still in flight,
    // sessionIdRef.current will change and the completion handlers below must
    // not hijack the new session's state.
    const mySessionId = sessionIdRef.current;

    // Each turn owns an AbortController. Starting a new conversation or loading
    // another session aborts the previous stream so it can't finish late and
    // corrupt the now-active conversation.
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch(`/api/parent/${vidyaId}/consultant/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: msg,
          sessionId: mySessionId,
          studentVidyaId: selectedStudentId,
          language: lang,
          provider,
          history,
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
        throw new ChatError(t("strategy.error"));
      }
      if (response.status === 429 || response.status === 403) {
        let friendlyMsg = t("strategy.error");
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) friendlyMsg = body.error;
        } catch {
          // keep default
        }
        throw new ChatError(friendlyMsg);
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
              sessionId?: string;
            };
            if (typeof data.chunk === "string") {
              fullContent += data.chunk;
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullContent } : m)),
              );
            }
            if (data.done) {
              // Defensive: if the active session changed mid-stream (without an
              // abort), don't let this completing turn hijack the new session's
              // pointer or history. Always release the streaming lock and mark
              // the bubble done, then refresh the sessions list.
              const stillActive = sessionIdRef.current === mySessionId;
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false } : m)),
              );
              if (stillActive) {
                if (data.sessionId) {
                  sessionIdRef.current = data.sessionId;
                  setActiveSessionId(data.sessionId);
                }
                setHistory((prev) => [
                  ...prev,
                  { role: "user", content: msg },
                  { role: "assistant", content: fullContent },
                ]);
                setIsContinuing(false);
              }
              setIsStreaming(false);
              void refetchSessions();
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (err) {
      // A deliberate abort (new conversation / session switch) is not an error;
      // the new flow already owns the UI state, so leave it untouched.
      if (controller.signal.aborted) return;
      const friendly = err instanceof ChatError ? err.message : t("strategy.error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: friendly, isStreaming: false } : m,
        ),
      );
      setIsStreaming(false);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const startNewChat = () => {
    // Cancel any in-flight reply stream so a late completion can't attach its
    // turn (or its session id) to the fresh conversation.
    streamAbortRef.current?.abort();
    setMessages([]);
    setHistory([]);
    setInput("");
    setAttachment(null);
    setStatusError(null);
    setIsContinuing(false);
    setIsStreaming(false);
    setActiveSessionId(null);
    setShowHistory(false);
    sessionIdRef.current = crypto.randomUUID();
  };

  const formatSessionDate = (value: Date | string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[420px] bg-white rounded-2xl shadow-md border border-indigo-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-indigo-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{t(titleKey)}</p>
          <p className="text-xs text-muted-foreground truncate">
            {isContinuing
              ? t("strategy.continue")
              : selectedStudentName
                ? `${t("strategy.about")}: ${selectedStudentName}`
                : t("strategy.general")}
          </p>
        </div>
        <AiModelSelect value={provider} onChange={setProvider} disabled={isStreaming} />
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
          onClick={startNewChat}
          disabled={messages.length === 0 && !activeSessionId}
          aria-label={t("strategy.newChat")}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("strategy.newChat")}
        >
          <Plus className="w-4 h-4" />
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
                        disabled={!!loadingSessionId}
                        className={`w-full text-left flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors disabled:opacity-60 ${
                          s.sessionId === activeSessionId
                            ? "bg-white border border-emerald-200 shadow-sm"
                            : "hover:bg-white/70 border border-transparent"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                          {loadingSessionId === s.sessionId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {s.preview || t("strategy.title")}
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-[#F7FAF9]">
        {messages.length === 0 && (
          <div className="flex items-start gap-2.5 max-w-[90%]">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-white border border-emerald-100 text-foreground rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
              <span className="whitespace-pre-wrap break-words">{welcomeText}</span>
              <div className="mt-1.5 -mb-1 -ml-1">
                <SpeakButton text={welcomeText} tone="dark" />
              </div>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === "user" ? (
                <div className="flex items-start gap-2.5 max-w-[90%] ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 mt-0.5">
                    <UserRound className="w-4 h-4" />
                  </div>
                  <div className="bg-white text-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm border border-indigo-100 max-w-full">
                    {msg.attachment ? (
                      msg.attachment.isImage ? (
                        <img
                          src={msg.attachment.dataUrl}
                          alt={msg.attachment.name}
                          className="mb-2 rounded-xl w-full max-w-[240px] border border-indigo-100"
                        />
                      ) : (
                        <div className="mb-2 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 max-w-[240px]">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs font-medium truncate">
                            {msg.attachment.name}
                          </span>
                        </div>
                      )
                    ) : msg.attachmentName ? (
                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 max-w-[240px]">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-medium truncate">{msg.attachmentName}</span>
                      </div>
                    ) : null}
                    {msg.content && (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 max-w-[90%]">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-emerald-100 text-foreground rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm max-w-full">
                    {msg.content ? (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    ) : (
                      msg.isStreaming && (
                        <span className="inline-flex items-center gap-1 py-0.5">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                              style={{ animationDelay: `${i * 0.18}s` }}
                            />
                          ))}
                        </span>
                      )
                    )}
                    {msg.isStreaming && msg.content && (
                      <span className="inline-block w-0.5 h-[14px] bg-emerald-400/60 ml-0.5 animate-pulse align-middle rounded-full" />
                    )}
                    {!msg.isStreaming && msg.content && (
                      <div className="mt-1.5 -mb-1 -ml-1">
                        <SpeakButton text={msg.content} tone="dark" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 bg-white border-t border-indigo-100 shrink-0">
        <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFilePicked} />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFilePicked}
        />

        {attachment && (
          <div className="mb-2 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-2">
            {attachment.isImage ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="w-10 h-10 rounded-lg object-cover border border-indigo-100 shrink-0"
              />
            ) : (
              <FileText className="w-5 h-5 text-primary shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground truncate flex-1">
              {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {statusError && (
          <p className="text-xs text-red-500 font-medium mb-2">{statusError}</p>
        )}
        {(isRecording || isTranscribing) && (
          <p className="text-xs text-emerald-600 font-medium mb-2 flex items-center gap-1.5">
            {isTranscribing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("strategy.transcribing")}
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {t("strategy.recording")}
              </>
            )}
          </p>
        )}

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-40 shrink-0"
            title={t("strategy.attach")}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isStreaming}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-indigo-50 transition-colors disabled:opacity-40 shrink-0"
            title={t("strategy.camera")}
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isStreaming || isTranscribing}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-40 shrink-0 ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "text-muted-foreground hover:text-primary hover:bg-indigo-50"
            }`}
            title="Voice"
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t(placeholderKey)}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-2xl border border-indigo-100 bg-gray-50 px-4 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 disabled:opacity-60 max-h-[120px]"
          />

          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={(!input.trim() && !attachment) || isStreaming}
            className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
            title={t("strategy.send")}
          >
            <SendHorizonal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
