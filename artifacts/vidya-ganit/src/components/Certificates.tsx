import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Lock } from "lucide-react";
import {
  useGetReportCard,
  getGetReportCardQueryKey,
  type ReportCardResponse,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import { exportCertificatePdf } from "@/lib/certificatePdf";

interface Milestone {
  id: string;
  titleKey: string;
  descKey: string;
  unlocked: (r: ReportCardResponse) => boolean;
}

const MILESTONES: Milestone[] = [
  { id: "first", titleKey: "cert.first.title", descKey: "cert.first.desc", unlocked: (r) => r.totalTests >= 1 },
  { id: "xp100", titleKey: "cert.xp100.title", descKey: "cert.xp100.desc", unlocked: (r) => r.xp >= 100 },
  { id: "xp500", titleKey: "cert.xp500.title", descKey: "cert.xp500.desc", unlocked: (r) => r.xp >= 500 },
  { id: "xp1000", titleKey: "cert.xp1000.title", descKey: "cert.xp1000.desc", unlocked: (r) => r.xp >= 1000 },
  { id: "streak7", titleKey: "cert.streak7.title", descKey: "cert.streak7.desc", unlocked: (r) => r.streakLongest >= 7 },
  { id: "streak30", titleKey: "cert.streak30.title", descKey: "cert.streak30.desc", unlocked: (r) => r.streakLongest >= 30 },
  {
    id: "sharp",
    titleKey: "cert.sharp.title",
    descKey: "cert.sharp.desc",
    unlocked: (r) => r.totalTests >= 3 && r.averageScorePct >= 80,
  },
];

export default function Certificates({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const { data: report, isLoading } = useGetReportCard(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetReportCardQueryKey(vidyaId) },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="border-0 shadow-md rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg leading-tight">{t("cert.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("cert.subtitle")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-6">{t("cert.loading")}</p>
      )}

      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MILESTONES.map((m) => {
            const unlocked = m.unlocked(report);
            return (
              <Card
                key={m.id}
                className={`border-0 shadow-sm rounded-2xl ${unlocked ? "" : "opacity-70"}`}
                data-testid={`card-cert-${m.id}`}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        unlocked ? "bg-amber-100" : "bg-gray-100"
                      }`}
                    >
                      {unlocked ? (
                        <Award className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Lock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground leading-tight">{t(m.titleKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(m.descKey)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={unlocked ? "default" : "outline"}
                    disabled={!unlocked}
                    onClick={() =>
                      exportCertificatePdf(t, {
                        studentName: report.student.name,
                        title: t(m.titleKey),
                        subtitle: t(m.descKey),
                      })
                    }
                    className="rounded-full gap-2 w-full"
                    data-testid={`button-cert-download-${m.id}`}
                  >
                    {unlocked ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {unlocked ? t("cert.download") : t("cert.locked")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
