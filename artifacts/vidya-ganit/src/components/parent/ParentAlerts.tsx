import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, RefreshCw, Loader2 } from "lucide-react";
import {
  useGetNotifications,
  getGetNotificationsQueryKey,
  useMarkNotificationsRead,
  useScanAlerts,
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

export default function ParentAlerts({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useGetNotifications(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetNotificationsQueryKey(vidyaId),
    },
  });
  const markReadMutation = useMarkNotificationsRead();
  const scanMutation = useScanAlerts();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const markAllRead = () => {
    if (!vidyaId) return;
    markReadMutation.mutate(
      { vidyaId, data: { all: true } },
      { onSuccess: () => refetch() },
    );
  };

  const scanNow = () => {
    if (!vidyaId) return;
    scanMutation.mutate({ vidyaId }, { onSuccess: () => refetch() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Bell className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("alerts.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("alerts.subtitle")}
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="font-bold">
                {t("notif.unread").replace("{count}", String(unreadCount))}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              data-testid="button-scan-alerts"
              disabled={scanMutation.isPending}
              onClick={scanNow}
              className="gap-1.5 rounded-full"
            >
              {scanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {scanMutation.isPending
                ? t("alerts.scanning")
                : t("alerts.scanNow")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="button-alerts-mark-all"
              disabled={unreadCount === 0 || markReadMutation.isPending}
              onClick={markAllRead}
              className="gap-1.5 text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("notif.markAllRead")}
            </Button>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("notif.loading")}
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("notif.empty")}
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid={`card-alert-${n.id}`}
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
