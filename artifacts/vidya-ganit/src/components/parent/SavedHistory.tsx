import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  History as HistoryIcon,
  ChevronDown,
  MessageSquare,
  GraduationCap,
  Rocket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetStudentHistory,
  getGetStudentHistoryQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SavedHistory({
  vidyaId,
  studentVidyaId,
}: {
  vidyaId: string;
  studentVidyaId: string;
}) {
  const { t } = useLanguage();
  const [openSession, setOpenSession] = useState<string | null>(null);

  const { data, isLoading } = useGetStudentHistory(vidyaId, studentVidyaId, {
    query: {
      enabled: !!vidyaId && !!studentVidyaId,
      queryKey: getGetStudentHistoryQueryKey(vidyaId, studentVidyaId),
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        {t("history.loading")}
      </div>
    );
  }

  const sessions = data?.sessions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-primary" />
          {t("history.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("history.subtitle")}</p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {t("history.empty.title")}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">{t("history.empty.hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => {
            const isOpen = openSession === session.sessionId;
            return (
              <Card key={session.sessionId} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSession(isOpen ? null : session.sessionId)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-primary shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">
                      {t("history.session")} {sessions.length - i}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(session.startedAt)} · {session.messageCount}{" "}
                      {t("history.messages")}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t bg-gray-50/60">
                    {session.messages.map((m, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-start gap-2.5 ${
                          m.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            m.role === "user"
                              ? "bg-primary text-white"
                              : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                          }`}
                        >
                          {m.role === "user" ? (
                            <GraduationCap className="w-4 h-4" />
                          ) : (
                            <Rocket className="w-4 h-4" />
                          )}
                        </div>
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${
                            m.role === "user"
                              ? "bg-white border border-indigo-100 text-foreground rounded-tr-sm"
                              : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tl-sm"
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">
                            {m.role === "user" ? t("history.student") : t("history.tutor")}
                          </p>
                          <span className="whitespace-pre-wrap break-words">{m.content}</span>
                        </div>
                      </motion.div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
