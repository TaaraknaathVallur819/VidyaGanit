import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkLinkStudents } from "@workspace/api-client-react";
import type { BulkLinkResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";
import { Users2, Loader2, CheckCircle2, XCircle } from "lucide-react";

const BULK_ID_PLACEHOLDER = "VG-STU-12345, VG-STU-67890";
const NO_BATCH = "__none__";

function parseIds(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((id) => id.trim().toUpperCase())
    .filter((id) => id.length > 0)
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

export default function BulkAddStudents({
  vidyaId,
  batches,
  onLinked,
}: {
  vidyaId: string;
  batches?: string[];
  onLinked: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [batch, setBatch] = useState<string>(NO_BATCH);
  const [results, setResults] = useState<BulkLinkResult[] | null>(null);
  const [error, setError] = useState("");
  const bulkMutation = useBulkLinkStudents();

  const batchOptions = batches?.filter((b) => b.trim().length > 0) ?? [];
  const showBatchSelect = batchOptions.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ids = parseIds(text);
    if (ids.length === 0) {
      setError(t("bulk.empty"));
      return;
    }
    bulkMutation.mutate(
      {
        vidyaId,
        data: {
          studentVidyaIds: ids,
          batch: showBatchSelect && batch !== NO_BATCH ? batch : null,
        },
      },
      {
        onSuccess: (res) => {
          setResults(res.results);
          onLinked();
        },
        onError: (err) => {
          setError(
            (err as { data?: { error?: string } })?.data?.error ?? t("auth.genericError"),
          );
        },
      },
    );
  };

  const reset = () => {
    setText("");
    setBatch(NO_BATCH);
    setResults(null);
    setError("");
  };

  const linkedCount = results?.filter((r) => r.status === "linked").length ?? 0;
  const skippedCount = (results?.length ?? 0) - linkedCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-bulk-add"
          className="gap-1.5 rounded-xl"
        >
          <Users2 className="w-4 h-4" />
          {t("bulk.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="w-4 h-4" /> {t("bulk.title")}
          </DialogTitle>
        </DialogHeader>

        {results ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm font-semibold text-foreground" data-testid="text-bulk-summary">
              {t("bulk.summary")
                .replace("{linked}", String(linkedCount))
                .replace("{skipped}", String(skippedCount))}
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {results.map((r) => {
                const ok = r.status === "linked";
                return (
                  <div
                    key={r.vidyaId}
                    className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50"
                  >
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-mono text-xs">{r.vidyaId}</span>
                    {r.name && <span className="text-muted-foreground truncate">· {r.name}</span>}
                    <span className={`ml-auto text-xs font-medium ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                      {t(`bulk.status.${r.status}`)}
                    </span>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl"
              data-testid="button-bulk-done"
            >
              {t("test.done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-ids">{t("bulk.desc")}</Label>
              <Textarea
                id="bulk-ids"
                data-testid="input-bulk-ids"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
                placeholder={BULK_ID_PLACEHOLDER}
                rows={5}
                className="font-mono text-sm resize-none"
              />
            </div>

            {showBatchSelect && (
              <div className="space-y-2">
                <Label>{t("bulk.batchLabel")}</Label>
                <Select value={batch} onValueChange={setBatch}>
                  <SelectTrigger data-testid="select-bulk-batch" className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BATCH}>{t("bulk.batchNone")}</SelectItem>
                    {batchOptions.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 font-medium" data-testid="text-bulk-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={bulkMutation.isPending}
              className="w-full rounded-xl gap-1.5"
              data-testid="button-bulk-submit"
            >
              {bulkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("bulk.submit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
