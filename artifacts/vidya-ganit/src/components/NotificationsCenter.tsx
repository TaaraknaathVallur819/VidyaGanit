import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, CheckCheck } from "lucide-react";
import {
  useGetNotifications,
  getGetNotificationsQueryKey,
  useMarkNotificationsRead,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsCenter({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useGetNotifications(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetNotificationsQueryKey(vidyaId),
    },
  });
  const markReadMutation = useMarkNotificationsRead();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const markAllRead = () => {
    if (!vidyaId) return;
    markReadMutation.mutate(
      { vidyaId, data: { all: true } },
      { onSuccess: () => refetch() },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="button-open-notifications"
          aria-label={t("notif.open")}
          className="relative rounded-full"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              data-testid="badge-notif-unread"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" /> {t("notif.title")}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 font-bold">
                {t("notif.unread").replace("{count}", String(unreadCount))}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{t("notif.subtitle")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="button-notif-mark-all"
            disabled={unreadCount === 0 || markReadMutation.isPending}
            onClick={markAllRead}
            className="gap-1.5 text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t("notif.markAllRead")}
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("notif.loading")}
            </p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("notif.empty")}
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-testid={`card-notif-${n.id}`}
                  className={`rounded-xl border p-3 ${
                    n.read
                      ? "bg-gray-50 border-gray-100"
                      : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatWhen(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
