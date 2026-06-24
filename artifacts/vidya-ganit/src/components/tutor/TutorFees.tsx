import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetTutorFees,
  getGetTutorFeesQueryKey,
  useRecordFeePayment,
  useDeleteFeePayment,
  FeePaymentMethod,
  FeePaymentStatus,
  type FeePaymentMethod as FeePaymentMethodT,
  type FeePaymentStatus as FeePaymentStatusT,
} from "@workspace/api-client-react";
import {
  IndianRupee,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
} from "lucide-react";

const METHODS: FeePaymentMethodT[] = [
  FeePaymentMethod.cash,
  FeePaymentMethod.upi,
  FeePaymentMethod.card,
  FeePaymentMethod.bank_transfer,
  FeePaymentMethod.cheque,
  FeePaymentMethod.other,
];

const STATUSES: FeePaymentStatusT[] = [
  FeePaymentStatus.paid,
  FeePaymentStatus.unpaid,
  FeePaymentStatus.pending,
];

export default function TutorFees({ vidyaId }: { vidyaId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data, isLoading } = useGetTutorFees(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetTutorFeesQueryKey(vidyaId) },
  });
  const records = data?.records ?? [];
  const summaries = data?.summaries ?? [];

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetTutorFeesQueryKey(vidyaId) });

  const recordMutation = useRecordFeePayment({
    mutation: { onSuccess: invalidate },
  });
  const deleteMutation = useDeleteFeePayment({
    mutation: { onSuccess: invalidate },
  });

  const [studentVidyaId, setStudentVidyaId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<FeePaymentMethodT>(FeePaymentMethod.cash);
  const [status, setStatus] = useState<FeePaymentStatusT>(FeePaymentStatus.paid);
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");
  const [paidOn, setPaidOn] = useState("");

  const amountNum = Number(amount);
  const canSubmit =
    studentVidyaId.length > 0 &&
    amount.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum >= 0 &&
    !recordMutation.isPending;

  const methodLabel = (m: string) =>
    t(
      m === "cash"
        ? "tutor.fees.methodCash"
        : m === "upi"
          ? "tutor.fees.methodUpi"
          : m === "card"
            ? "tutor.fees.methodCard"
            : m === "bank_transfer"
              ? "tutor.fees.methodBank"
              : m === "cheque"
                ? "tutor.fees.methodCheque"
                : "tutor.fees.methodOther",
    );

  const statusLabel = (s: string | null | undefined) =>
    s === "paid"
      ? t("tutor.fees.statusPaid")
      : s === "unpaid"
        ? t("tutor.fees.statusUnpaid")
        : s === "pending"
          ? t("tutor.fees.statusPending")
          : t("tutor.fees.notRecorded");

  const statusClass = (s: string | null | undefined) =>
    s === "paid"
      ? "bg-green-100 text-green-700"
      : s === "unpaid"
        ? "bg-red-100 text-red-700"
        : s === "pending"
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-500";

  const StatusIcon = ({ s }: { s: string | null | undefined }) =>
    s === "paid" ? (
      <CheckCircle2 className="w-3.5 h-3.5" />
    ) : s === "unpaid" ? (
      <XCircle className="w-3.5 h-3.5" />
    ) : s === "pending" ? (
      <Clock className="w-3.5 h-3.5" />
    ) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    recordMutation.mutate(
      {
        vidyaId,
        data: {
          studentVidyaId,
          amount: Math.round(amountNum),
          method,
          status,
          period: period.trim() || null,
          note: note.trim() || null,
          paidOn: paidOn || null,
        },
      },
      {
        onSuccess: () => {
          setAmount("");
          setPeriod("");
          setNote("");
          setPaidOn("");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          {t("tutor.fees.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("tutor.fees.subtitle")}</p>
      </div>

      {summaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <IndianRupee className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">{t("tutor.fees.noStudents")}</p>
        </div>
      ) : (
        <>
          {/* Record a payment */}
          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <h3 className="font-semibold text-foreground">{t("tutor.fees.recordTitle")}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("tutor.fees.student")}</Label>
                <Select value={studentVidyaId} onValueChange={setStudentVidyaId}>
                  <SelectTrigger data-testid="select-fee-student">
                    <SelectValue placeholder={t("tutor.fees.selectStudent")} />
                  </SelectTrigger>
                  <SelectContent>
                    {summaries.map((s) => (
                      <SelectItem key={s.studentVidyaId} value={s.studentVidyaId}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-amount">{t("tutor.fees.amount")}</Label>
                <Input
                  id="fee-amount"
                  data-testid="input-fee-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t("tutor.fees.amountPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("tutor.fees.method")}</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as FeePaymentMethodT)}>
                  <SelectTrigger data-testid="select-fee-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {methodLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tutor.fees.status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as FeePaymentStatusT)}>
                  <SelectTrigger data-testid="select-fee-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-period">{t("tutor.fees.period")}</Label>
                <Input
                  id="fee-period"
                  data-testid="input-fee-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder={t("tutor.fees.periodPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-paid-on">{t("tutor.fees.paidOn")}</Label>
                <Input
                  id="fee-paid-on"
                  data-testid="input-fee-paid-on"
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-note">{t("tutor.fees.note")}</Label>
              <Textarea
                id="fee-note"
                data-testid="input-fee-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("tutor.fees.notePlaceholder")}
                rows={2}
              />
            </div>
            <Button type="submit" disabled={!canSubmit} data-testid="button-save-fee">
              {recordMutation.isPending ? t("tutor.fees.saving") : t("tutor.fees.save")}
            </Button>
          </form>

          {/* Per-student status overview */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">{t("tutor.fees.overview")}</h3>
            <div className="space-y-2">
              {summaries.map((s) => (
                <div
                  key={s.studentVidyaId}
                  className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100"
                  data-testid={`fee-summary-${s.studentVidyaId}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("tutor.fees.totalPaid")}: ₹{s.totalPaid}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass(s.latestStatus)}`}
                  >
                    <StatusIcon s={s.latestStatus} />
                    {statusLabel(s.latestStatus)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment history */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">{t("tutor.fees.history")}</h3>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("tutor.fees.noRecords")}
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-100"
                    data-testid={`fee-record-${r.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{r.studentName}</p>
                        <span className="font-bold text-foreground text-sm">₹{r.amount}</span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass(r.status)}`}
                        >
                          <StatusIcon s={r.status} />
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>{methodLabel(r.method)}</span>
                        {r.period && <span>· {r.period}</span>}
                        {r.paidOn && <span>· {r.paidOn}</span>}
                      </p>
                      {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t("tutor.fees.deleteConfirm"))) {
                          deleteMutation.mutate({ vidyaId, feeId: String(r.id) });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      title={t("tutor.fees.delete")}
                      data-testid={`button-delete-fee-${r.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
