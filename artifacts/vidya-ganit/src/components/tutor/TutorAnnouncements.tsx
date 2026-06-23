import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Loader2, Send, Users2 } from "lucide-react";
import {
  useListAnnouncements,
  getListAnnouncementsQueryKey,
  useCreateAnnouncement,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TutorAnnouncements({
  vidyaId,
  batches,
}: {
  vidyaId: string;
  batches: string[];
}) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useListAnnouncements(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getListAnnouncementsQueryKey(vidyaId),
    },
  });
  const announcements = data?.announcements ?? [];

  const createMutation = useCreateAnnouncement();

  const [batch, setBatch] = useState<string>(batches[0] ?? "");
  const [message, setMessage] = useState("");

  const hasBatches = batches.length > 0;
  const canSubmit = !!batch && !!message.trim() && !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(
      { vidyaId, data: { batch, message: message.trim() } },
      {
        onSuccess: () => {
          setMessage("");
          refetch();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          {t("announce.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("announce.subtitle")}</p>
      </div>

      {/* Compose form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            {!hasBatches ? (
              <p className="text-sm text-muted-foreground bg-gray-50 border border-gray-100 rounded-xl p-4">
                {t("announce.noBatches")}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("announce.batch")}</Label>
                  <Select value={batch} onValueChange={setBatch}>
                    <SelectTrigger className="h-11 rounded-xl" data-testid="select-announce-batch">
                      <SelectValue placeholder={t("announce.selectBatch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="announce-message">{t("announce.message")}</Label>
                  <Textarea
                    id="announce-message"
                    data-testid="input-announce-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("announce.messagePlaceholder")}
                    rows={3}
                    className="resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="button-create-announcement"
                  disabled={!canSubmit}
                  className="w-full h-11 rounded-xl font-semibold gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("announce.sending")}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {t("announce.send")}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Past announcements */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg text-foreground mb-5">
              {t("announce.past")}
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("announce.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    data-testid={`row-announcement-${a.id}`}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        <Users2 className="w-3 h-3" />
                        {a.batch}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
