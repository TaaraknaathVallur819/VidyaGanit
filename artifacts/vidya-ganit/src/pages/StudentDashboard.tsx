import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useListOwnAssessments,
  getListOwnAssessmentsQueryKey,
} from "@workspace/api-client-react";
import {
  User,
  Star,
  Zap,
  Pencil,
  Lock,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Gamepad2,
  ClipboardCheck,
} from "lucide-react";
import SocraticChat from "@/components/SocraticChat";
import MiniGames from "@/components/MiniGames";
import AssessmentTest from "@/components/AssessmentTest";
import AssessmentReport from "@/components/AssessmentReport";
import VoiceSettings from "@/components/VoiceSettings";
import FloatingShapes from "@/components/FloatingShapes";
import { BADGE_CATALOG } from "@/lib/badges";
import { useLanguage } from "@/lib/i18n";

const TEST_TOPICS: { topic: string; key: string }[] = [
  { topic: "fraction", key: "test.topic.fraction" },
  { topic: "multiply", key: "test.topic.multiply" },
  { topic: "divide", key: "test.topic.divide" },
  { topic: "decimal", key: "test.topic.decimal" },
  { topic: "percent", key: "test.topic.percent" },
  { topic: "geometry", key: "test.topic.geometry" },
];

function getLevelInfo(xp: number) {
  const LEVELS = [
    { level: 1, min: 0, nextMin: 100 },
    { level: 2, min: 100, nextMin: 250 },
    { level: 3, min: 250, nextMin: 500 },
    { level: 4, min: 500, nextMin: 1000 },
    { level: 5, min: 1000, nextMin: Infinity },
  ];
  const lvl =
    [...LEVELS].reverse().find((l) => xp >= l.min) ?? LEVELS[0];
  const progress =
    lvl.nextMin === Infinity
      ? 100
      : Math.min(100, ((xp - lvl.min) / (lvl.nextMin - lvl.min)) * 100);
  const xpToNext = lvl.nextMin === Infinity ? 0 : lvl.nextMin - xp;
  return { ...lvl, progress, xpToNext };
}

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


export default function StudentDashboard() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const vidyaId = user?.vidyaId ?? "";

  const { data: profile, refetch } = useGetProfile(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetProfileQueryKey(vidyaId) },
  });

  const displayed = profile ?? user;
  const xp = displayed?.role === "student" ? (displayed.xp ?? 0) : 0;
  const earnedBadges: string[] = displayed?.role === "student" ? (displayed.badges ?? []) : [];
  const levelInfo = getLevelInfo(xp);

  // Edit Profile dialog
  const [editOpen, setEditOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  // Assessment test
  const [testOpen, setTestOpen] = useState(false);
  const [testTopic, setTestTopic] = useState("general");
  const { data: assessments, isLoading: assessmentsLoading, refetch: refetchAssessments } =
    useListOwnAssessments(vidyaId, {
      query: { enabled: !!vidyaId, queryKey: getListOwnAssessmentsQueryKey(vidyaId) },
    });

  const startTest = (topic: string) => {
    setTestTopic(topic);
    setTestOpen(true);
  };
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
    <div className="flex-1 bg-gray-50/50 flex flex-col" style={{ height: "100dvh" }}>
      <Tabs defaultValue="workspace" className="flex flex-col flex-1 overflow-hidden">
        <div className="border-b bg-white px-6 pt-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-3">{t("student.workspaceTitle")}</h1>
            <TabsList className="bg-transparent p-0 gap-6 border-b-0">
              <TabsTrigger
                value="profile"
                className="px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-semibold"
              >
                {t("student.tab.profile")}
              </TabsTrigger>
              <TabsTrigger
                value="workspace"
                className="px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-semibold"
              >
                {t("student.tab.workspace")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ── My Profile Tab ── */}
        <TabsContent value="profile" className="mt-0 p-6 relative">
          <FloatingShapes />
          <div className="max-w-3xl mx-auto space-y-6 relative">

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
                      <User className="w-10 h-10" />
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
                    <InfoChip label={t("student.class")} value={displayed.studentClass ? `${t("common.class")} ${displayed.studentClass}` : "—"} icon={<GraduationCap className="w-3.5 h-3.5" />} />
                    <InfoChip label={t("student.board")} value={displayed.board ?? "—"} icon={<BookOpen className="w-3.5 h-3.5" />} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Gamification Section */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-lg text-foreground">{t("student.mathXp")}</h3>
                    <Badge variant="secondary" className="ml-auto text-base font-bold px-3 py-1">{xp} XP</Badge>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                      <span>{t("student.level")} {levelInfo.level} — {t(`level.${levelInfo.level}`)}</span>
                      {levelInfo.nextMin === Infinity
                        ? <span>{t("student.maxLevel")}</span>
                        : <span>{t("student.xpToNext").replace("{xp}", String(levelInfo.xpToNext)).replace("{level}", String(levelInfo.level + 1))}</span>
                      }
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${levelInfo.progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-amber-400" />
                      <h3 className="font-bold text-foreground">{t("student.badgesEarned")}</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{t("student.earnedCount").replace("{earned}", String(earnedBadges.length)).replace("{total}", String(BADGE_CATALOG.length))}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {BADGE_CATALOG.map((badge) => {
                        const earned = earnedBadges.includes(badge.id);
                        return (
                          <motion.div
                            key={badge.id}
                            initial={false}
                            animate={earned ? { scale: [1, 1.12, 1] } : {}}
                            transition={{ duration: 0.4 }}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 p-1 transition-colors ${
                              earned
                                ? "bg-amber-50 border-2 border-amber-200 shadow-sm"
                                : "bg-gray-100 border-2 border-dashed border-gray-200"
                            }`}
                            title={earned ? badge.name : t("student.keepLearningToUnlock")}
                          >
                            {earned ? (
                              <>
                                <span className="text-xl leading-none">{badge.emoji}</span>
                                <span className="text-[9px] text-amber-700 font-semibold text-center leading-tight px-0.5">{badge.name}</span>
                              </>
                            ) : (
                              <Star className="w-5 h-5 text-gray-300" />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                    {earnedBadges.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        {t("student.noBadgesHint")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Gamepad2 className="w-5 h-5" />
                      <h3 className="font-bold">{t("games.title")}</h3>
                    </div>
                    <p className="text-xs text-white/85 mb-3">{t("games.subtitle")}</p>
                    <Button
                      type="button"
                      data-testid="button-open-games"
                      onClick={() => setGamesOpen(true)}
                      className="w-full h-10 rounded-xl bg-white font-bold text-indigo-600 hover:bg-white/90"
                    >
                      {t("games.play")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Take a Test */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
            >
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-lg text-foreground">{t("test.takeTitle")}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">{t("test.takeSubtitle")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {TEST_TOPICS.map((tt) => (
                      <Button
                        key={tt.topic}
                        type="button"
                        variant="outline"
                        data-testid={`button-take-test-${tt.topic}`}
                        onClick={() => startTest(tt.topic)}
                        className="h-11 rounded-xl font-semibold justify-center hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                      >
                        {t(tt.key)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* My Scores */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <Star className="w-5 h-5 text-violet-500" />
                <h3 className="font-bold text-lg text-foreground">{t("report.myScores")}</h3>
              </div>
              <AssessmentReport
                results={assessments?.results ?? []}
                isLoading={assessmentsLoading}
                variant="kid"
              />
            </motion.div>

            {/* Voice Settings */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
            >
              <VoiceSettings />
            </motion.div>
          </div>
        </TabsContent>

        {/* ── Workspace Tab ── */}
        <TabsContent value="workspace" className="mt-0 flex-1 overflow-hidden flex flex-col">
          <SocraticChat
            vidyaId={vidyaId}
            studentName={displayed?.name ?? "Student"}
            studentClass={displayed?.studentClass ?? null}
            board={displayed?.board ?? null}
            onXpAwarded={() => { refetch(); }}
          />
        </TabsContent>
      </Tabs>

      {/* ── Assessment Test ── */}
      <AssessmentTest
        open={testOpen}
        onClose={() => setTestOpen(false)}
        topic={testTopic}
        vidyaId={vidyaId}
        onCompleted={() => {
          refetchAssessments();
          refetch();
        }}
      />

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

      <MiniGames
        open={gamesOpen}
        onClose={() => setGamesOpen(false)}
        vidyaId={vidyaId}
        studentClass={displayed?.studentClass ?? null}
        onXpAwarded={() => { refetch(); }}
      />
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
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
