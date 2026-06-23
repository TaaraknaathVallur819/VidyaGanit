import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid3x3, Loader2, Layers } from "lucide-react";
import {
  useGetClassHeatmap,
  getGetClassHeatmapQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

const ALL_BATCHES = "__all__";
const UNASSIGNED_BATCH = "__unassigned__";

function cellClass(mastery: number | null): string {
  if (mastery === null) return "bg-gray-100 text-gray-400";
  if (mastery < 40) return "bg-red-100 text-red-700";
  if (mastery <= 70) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

export default function ClassHeatmap({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();

  const { data, isLoading } = useGetClassHeatmap(vidyaId, {
    query: {
      enabled: !!vidyaId,
      queryKey: getGetClassHeatmapQueryKey(vidyaId),
    },
  });

  const topics = data?.topics ?? [];
  const rows = data?.rows ?? [];

  const [batchFilter, setBatchFilter] = useState<string>(ALL_BATCHES);

  const batchValues = Array.from(
    new Set(rows.map((r) => r.batch).filter((b): b is string => !!b)),
  );
  const hasUnassigned = rows.some((r) => !r.batch);

  const filteredRows =
    batchFilter === ALL_BATCHES
      ? rows
      : batchFilter === UNASSIGNED_BATCH
        ? rows.filter((r) => !r.batch)
        : rows.filter((r) => r.batch === batchFilter);

  const showFilter = batchValues.length > 0 || hasUnassigned;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-primary" />
            {t("heatmap.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("heatmap.subtitle")}</p>
        </div>
        {showFilter && (
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger
              className="w-auto gap-2 h-9 rounded-xl shrink-0"
              data-testid="select-heatmap-batch"
              aria-label={t("heatmap.filterByBatch")}
            >
              <Layers className="w-4 h-4 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BATCHES}>{t("heatmap.allBatches")}</SelectItem>
              {batchValues.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
              {hasUnassigned && (
                <SelectItem value={UNASSIGNED_BATCH}>{t("heatmap.unassigned")}</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          {t("heatmap.legend.low")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
          {t("heatmap.legend.mid")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          {t("heatmap.legend.high")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          {t("heatmap.legend.none")}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : topics.length === 0 || filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("heatmap.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white text-left font-semibold text-foreground px-3 py-2 border-b">
                        {t("heatmap.student")}
                      </th>
                      {topics.map((topic) => (
                        <th
                          key={topic}
                          className="font-semibold text-muted-foreground px-2 py-2 border-b text-center whitespace-nowrap"
                        >
                          {topic}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.studentVidyaId} data-testid={`row-heatmap-${row.studentVidyaId}`}>
                        <td className="sticky left-0 bg-white px-3 py-2 border-b">
                          <p className="font-semibold text-foreground truncate max-w-[10rem]">
                            {row.name}
                          </p>
                          {row.batch && (
                            <p className="text-xs text-muted-foreground">{row.batch}</p>
                          )}
                        </td>
                        {topics.map((topic) => {
                          const raw = row.topics[topic];
                          const mastery =
                            raw === null || raw === undefined ? null : raw;
                          return (
                            <td key={topic} className="px-2 py-2 border-b text-center">
                              <span
                                className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg font-semibold ${cellClass(
                                  mastery,
                                )}`}
                              >
                                {mastery === null ? "—" : `${Math.round(mastery)}%`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
