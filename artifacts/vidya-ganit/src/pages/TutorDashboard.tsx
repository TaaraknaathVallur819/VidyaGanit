import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  useGetProfile,
  getGetProfileQueryKey,
  useUpdateProfile,
  useChangePassword,
} from "@workspace/api-client-react";
import {
  GraduationCap,
  Pencil,
  Lock,
  Users2,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

function getPasswordStrength(pwd: string) {
  if (!pwd) return { label: "", color: "", barColor: "", level: 0 };
  const hasLetters = /[a-zA-Z]/.test(pwd);
  const hasNumbers = /[0-9]/.test(pwd);
  const hasSymbols = /[^a-zA-Z0-9]/.test(pwd);
  const isLongEnough = pwd.length >= 8;
  if (!isLongEnough || (hasLetters && !hasNumbers && !hasSymbols))
    return { label: "Weak", color: "text-red-500", barColor: "bg-red-500", level: 1 };
  if (isLongEnough && !(hasLetters && hasNumbers && hasSymbols))
    return { label: "Medium", color: "text-orange-500", barColor: "bg-orange-500", level: 2 };
  return { label: "Strong", color: "text-green-500", barColor: "bg-green-500", level: 3 };
}

export default function TutorDashboard() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const vidyaId = user?.vidyaId ?? "";

  const { data: profile, refetch } = useGetProfile(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetProfileQueryKey(vidyaId) },
  });

  const displayed = profile ?? user;

  // Edit Profile dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<"male" | "female">("male");
  const [editError, setEditError] = useState("");
  const updateMutation = useUpdateProfile();

  const openEdit = () => {
    setEditName(displayed?.name ?? "");
    setEditGender((displayed?.gender as "male" | "female") ?? "male");
    setEditError("");
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    updateMutation.mutate(
      { vidyaId, data: { name: editName.trim(), gender: editGender } },
      {
        onSuccess: (updated) => {
          setUser(updated);
          refetch();
          setEditOpen(false);
        },
        onError: (err) => {
          setEditError(
            (err as { data?: { error?: string } })?.data?.error ?? t("student.updateFailed"),
          );
        },
      },
    );
  };

  // Change Password dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const changePwMutation = useChangePassword();
  const strength = getPasswordStrength(newPw);

  const openPw = () => {
    setCurrentPw("");
    setNewPw("");
    setPwError("");
    setPwSuccess("");
    setPwOpen(true);
  };

  const handleChangePw = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    changePwMutation.mutate(
      { vidyaId, data: { currentPassword: currentPw, newPassword: newPw } },
      {
        onSuccess: (data) => {
          setPwSuccess(data.message);
          setCurrentPw("");
          setNewPw("");
        },
        onError: (err) => {
          setPwError(
            (err as { data?: { error?: string } })?.data?.error ??
              t("student.changePwFailed"),
          );
        },
      },
    );
  };

  if (!displayed) return null;

  return (
    <div className="flex-1 bg-gray-50/50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{t("tutor.title")}</h1>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary via-primary/80 to-secondary" />
            <CardContent className="px-6 pb-6 -mt-10">
              <div className="flex items-end justify-between mb-5">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-md border-4 border-white flex items-center justify-center text-primary">
                  <GraduationCap className="w-10 h-10" />
                </div>
                <div className="flex gap-2 mb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openEdit}
                    data-testid="button-edit-profile"
                    className="gap-1.5 rounded-full"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t("student.editProfile")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openPw}
                    data-testid="button-change-password"
                    className="gap-1.5 rounded-full"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {t("student.changePassword")}
                  </Button>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-foreground">{displayed.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono tracking-wide">{displayed.vidyaId}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                <InfoChip label={t("student.gender")} value={displayed.gender === "male" ? t("student.male") : t("student.female")} />
                <InfoChip label={t("tutor.batch")} value={displayed.batch ?? "—"} icon={<Users2 className="w-3.5 h-3.5" />} />
                <InfoChip label={t("auth.emailOrPhone")} value={displayed.contact ?? "—"} icon={<Mail className="w-3.5 h-3.5" />} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> {t("student.editProfile")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("student.fullName")}</Label>
              <Input
                id="edit-name"
                data-testid="input-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("student.gender")}</Label>
              <div className="flex gap-3">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-testid={`edit-gender-${g}`}
                    onClick={() => setEditGender(g)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      editGender === g
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {g === "male" ? t("student.male") : t("student.female")}
                  </button>
                ))}
              </div>
            </div>
            {editError && (
              <p className="text-sm text-red-500 font-medium">{editError}</p>
            )}
            <Button
              type="submit"
              data-testid="button-save-profile"
              disabled={updateMutation.isPending}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {updateMutation.isPending ? t("student.saving") : t("student.saveChanges")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ── */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> {t("student.changePassword")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePw} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="current-pw">{t("student.currentPassword")}</Label>
              <Input
                id="current-pw"
                data-testid="input-current-password"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">{t("student.newPassword")}</Label>
              <Input
                id="new-pw"
                data-testid="input-new-password"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={t("student.passwordHint")}
                className="h-11"
                required
              />
              {newPw && (
                <div className="space-y-1.5 mt-1">
                  <span data-testid="text-new-pw-strength" className={`text-sm font-medium ${strength.color}`}>
                    {t("strength.label")} {strength.label}
                  </span>
                  <div className="flex gap-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${strength.level >= 1 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                    <div className={`h-full transition-all ${strength.level >= 2 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                    <div className={`h-full transition-all ${strength.level >= 3 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                  </div>
                </div>
              )}
              {newPw && strength.level < 3 && (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2.5 leading-relaxed">
                  {t("student.passwordMixHint")}
                </p>
              )}
            </div>
            {pwError && (
              <p data-testid="message-pw-error" className="text-sm text-red-500 font-medium">{pwError}</p>
            )}
            {pwSuccess && (
              <div data-testid="message-pw-success" className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {pwSuccess}
              </div>
            )}
            <Button
              type="submit"
              data-testid="button-save-password"
              disabled={!currentPw || strength.level < 3 || changePwMutation.isPending}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {changePwMutation.isPending ? t("student.updating") : t("student.updatePassword")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
      <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
