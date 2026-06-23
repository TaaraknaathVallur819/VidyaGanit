import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { useGetWorksheet } from "@workspace/api-client-react";
import { exportWorksheetPdf } from "@/lib/worksheetPdf";
import { useLanguage } from "@/lib/i18n";

const WORKSHEET_TOPICS: { topic: string; key: string }[] = [
  { topic: "fraction", key: "test.topic.fraction" },
  { topic: "multiply", key: "test.topic.multiply" },
  { topic: "divide", key: "test.topic.divide" },
  { topic: "decimal", key: "test.topic.decimal" },
  { topic: "percent", key: "test.topic.percent" },
  { topic: "geometry", key: "test.topic.geometry" },
];

const COUNTS = [5, 10, 15, 20];
const CLASSES = ["4", "5", "6", "7"];

export default function WorksheetGenerator({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const [topic, setTopic] = useState("fraction");
  const [count, setCount] = useState(10);
  const [klass, setKlass] = useState<string>("any");
  const [error, setError] = useState("");

  const worksheetMutation = useGetWorksheet();

  const generate = () => {
    setError("");
    worksheetMutation.mutate(
      {
        vidyaId,
        data: {
          topic,
          count,
          klass: klass === "any" ? null : klass,
        },
      },
      {
        onSuccess: (data) => exportWorksheetPdf(t, data),
        onError: () => setError(t("worksheet.error")),
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
            <FileText className="w-5 h-5 text-sky-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("worksheet.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("worksheet.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("worksheet.topic")}</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger data-testid="select-worksheet-topic" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKSHEET_TOPICS.map((ws) => (
                    <SelectItem key={ws.topic} value={ws.topic}>
                      {t(ws.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("worksheet.count")}</Label>
              <Select
                value={String(count)}
                onValueChange={(v) => setCount(Number(v))}
              >
                <SelectTrigger data-testid="select-worksheet-count" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("worksheet.klass")}</Label>
              <Select value={klass} onValueChange={setKlass}>
                <SelectTrigger data-testid="select-worksheet-class" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("worksheet.anyClass")}</SelectItem>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            type="button"
            data-testid="button-worksheet-generate"
            onClick={generate}
            disabled={worksheetMutation.isPending}
            className="w-full h-11 rounded-xl font-semibold gap-1.5"
          >
            <Download className="w-4 h-4" />
            {worksheetMutation.isPending
              ? t("worksheet.generating")
              : t("worksheet.generate")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
