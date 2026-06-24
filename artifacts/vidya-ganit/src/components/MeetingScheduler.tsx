import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Check, X, Ban } from "lucide-react";
import {
  useGetMeetings,
  getGetMeetingsQueryKey,
  useProposeMeeting,
  useRespondMeeting,
  useCancelMeeting,
  type Meeting,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function MeetingScheduler({
  vidyaId,
  role,
}: {
  vidyaId: string;
  role: "parent" | "tutor";
}) {
  const { t } = useLanguage();
  const [contact, setContact] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("30");
  const [note, setNote] = useState("");

  const { data, refetch } = useGetMeetings(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetMeetingsQueryKey(vidyaId) },
  });
  const propose = useProposeMeeting();
  const respond = useRespondMeeting();
  const cancel = useCancelMeeting();

  const contacts = data?.contacts ?? [];
  const meetings = data?.meetings ?? [];

  const submitProposal = () => {
    if (!contact || !when) return;
    propose.mutate(
      {
        vidyaId,
        data: {
          counterpartVidyaId: contact,
          scheduledAt: new Date(when).toISOString(),
          durationMin: Number(duration),
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setWhen("");
          setNote("");
          refetch();
        },
      },
    );
  };

  const reply = (m: Meeting, status: "confirmed" | "declined") => {
    respond.mutate(
      { vidyaId, meetingId: String(m.id), data: { status } },
      { onSuccess: () => refetch() },
    );
  };

  const cancelMeeting = (m: Meeting) => {
    cancel.mutate({ vidyaId, meetingId: String(m.id) }, { onSuccess: () => refetch() });
  };

  const statusBadge = (s: string) => {
    if (s === "confirmed") return <Badge className="bg-emerald-500">{t("meeting.confirmed")}</Badge>;
    if (s === "declined") return <Badge className="bg-red-500">{t("meeting.declined")}</Badge>;
    if (s === "cancelled") return <Badge className="bg-gray-400">{t("meeting.cancelled")}</Badge>;
    return <Badge className="bg-amber-500">{t("meeting.pending")}</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("meeting.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("meeting.subtitle")}</p>
            </div>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {role === "tutor" ? t("meeting.noParents") : t("meeting.noTutors")}
            </p>
          ) : (
            <div className="space-y-3">
              <Select value={contact ?? undefined} onValueChange={setContact}>
                <SelectTrigger className="rounded-xl h-9" data-testid="select-meeting-contact">
                  <SelectValue placeholder={t("meeting.pickContact")} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.vidyaId} value={c.vidyaId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="rounded-xl h-9"
                  data-testid="input-meeting-when"
                />
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="rounded-xl h-9" data-testid="select-meeting-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 {t("meeting.minutes")}</SelectItem>
                    <SelectItem value="30">30 {t("meeting.minutes")}</SelectItem>
                    <SelectItem value="45">45 {t("meeting.minutes")}</SelectItem>
                    <SelectItem value="60">60 {t("meeting.minutes")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("meeting.notePlaceholder")}
                maxLength={500}
                className="rounded-xl resize-none"
                rows={2}
                data-testid="input-meeting-note"
              />
              <Button
                onClick={submitProposal}
                disabled={propose.isPending || !contact || !when}
                className="rounded-full"
                data-testid="button-propose-meeting"
              >
                {t("meeting.propose")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <h4 className="font-bold text-foreground">{t("meeting.upcoming")}</h4>
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("meeting.none")}</p>
          ) : (
            meetings.map((m) => {
              const canRespond = m.status === "pending" && m.proposedBy !== role;
              const canCancel = m.status === "pending" || m.status === "confirmed";
              return (
                <div
                  key={m.id}
                  className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2"
                  data-testid={`card-meeting-${m.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">
                        {t("meeting.with")} {m.counterpartName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.scheduledAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · {m.durationMin} {t("meeting.minutes")}
                      </p>
                      {m.note && <p className="text-xs text-muted-foreground mt-1 italic">{m.note}</p>}
                    </div>
                    {statusBadge(m.status)}
                  </div>
                  {(canRespond || canCancel) && (
                    <div className="flex gap-2 flex-wrap">
                      {canRespond && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => reply(m, "confirmed")}
                            className="rounded-full gap-1"
                            data-testid={`button-meeting-confirm-${m.id}`}
                          >
                            <Check className="w-3 h-3" />
                            {t("meeting.accept")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reply(m, "declined")}
                            className="rounded-full gap-1"
                            data-testid={`button-meeting-decline-${m.id}`}
                          >
                            <X className="w-3 h-3" />
                            {t("meeting.decline")}
                          </Button>
                        </>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelMeeting(m)}
                          className="rounded-full gap-1 text-red-600"
                          data-testid={`button-meeting-cancel-${m.id}`}
                        >
                          <Ban className="w-3 h-3" />
                          {t("meeting.cancel")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
