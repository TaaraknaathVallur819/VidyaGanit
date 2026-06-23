import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, ChevronLeft } from "lucide-react";
import {
  useGetMessageThreads,
  getGetMessageThreadsQueryKey,
  useGetMessageThread,
  getGetMessageThreadQueryKey,
  useSendMessage,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function roleLabel(role: string, t: (k: string) => string): string {
  if (role === "tutor") return t("messages.roleTutor");
  if (role === "parent") return t("messages.roleParent");
  return role;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Messages({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: threadsData, refetch: refetchThreads } = useGetMessageThreads(
    vidyaId,
    {
      query: {
        enabled: !!vidyaId,
        queryKey: getGetMessageThreadsQueryKey(vidyaId),
      },
    },
  );
  const threads = threadsData?.threads ?? [];

  const { data: thread, refetch: refetchThread } = useGetMessageThread(
    vidyaId,
    activeId ?? "",
    {
      query: {
        enabled: !!vidyaId && !!activeId,
        queryKey: getGetMessageThreadQueryKey(vidyaId, activeId ?? ""),
      },
    },
  );

  const sendMutation = useSendMessage();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages.length, activeId]);

  // Opening a thread marks it read on the server; refresh the list so the
  // unread badge clears.
  useEffect(() => {
    if (activeId) refetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    sendMutation.mutate(
      { vidyaId, data: { to: activeId, body: text } },
      {
        onSuccess: () => {
          setDraft("");
          refetchThread();
          refetchThreads();
        },
      },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("messages.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("messages.subtitle")}
              </p>
            </div>
          </div>

          {!activeId ? (
            threads.length === 0 ? (
              <div className="text-center py-10 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t("messages.empty")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("messages.emptyHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((th) => (
                  <button
                    key={th.otherVidyaId}
                    type="button"
                    data-testid={`button-thread-${th.otherVidyaId}`}
                    onClick={() => setActiveId(th.otherVidyaId)}
                    className="w-full text-left rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors p-4 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                      {th.otherName.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {th.otherName}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {roleLabel(th.otherRole, t)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {th.lastBody || t("messages.threadEmpty")}
                      </p>
                    </div>
                    {th.unread > 0 && (
                      <Badge className="shrink-0 font-bold" data-testid={`badge-unread-${th.otherVidyaId}`}>
                        {t("messages.unread").replace("{count}", String(th.unread))}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2"
                  data-testid="button-thread-back"
                  onClick={() => setActiveId(null)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("messages.back")}
                </Button>
                <span className="font-semibold text-foreground">
                  {thread?.otherName ?? ""}
                </span>
                {thread?.otherRole && (
                  <Badge variant="outline" className="text-[10px]">
                    {roleLabel(thread.otherRole, t)}
                  </Badge>
                )}
              </div>

              <div
                ref={scrollRef}
                className="h-72 overflow-y-auto rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-2"
                data-testid="container-thread-messages"
              >
                {!thread || thread.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    {t("messages.threadEmpty")}
                  </p>
                ) : (
                  thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                          m.mine
                            ? "bg-indigo-500 text-white rounded-br-sm"
                            : "bg-white border border-gray-100 text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${m.mine ? "text-white/70" : "text-muted-foreground"}`}
                        >
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={t("messages.placeholder")}
                  maxLength={2000}
                  className="h-11 rounded-xl"
                />
                <Button
                  type="button"
                  data-testid="button-message-send"
                  onClick={send}
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="h-11 rounded-xl gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  {sendMutation.isPending ? t("messages.sending") : t("messages.send")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
