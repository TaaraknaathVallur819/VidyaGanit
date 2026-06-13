import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useGetLinkedStudents,
  getGetLinkedStudentsQueryKey,
  useLinkStudent,
  useUnlinkStudent,
  useUpdateProfile,
  useChangePassword,
} from "@workspace/api-client-react";
import {
  User,
  Pencil,
  Lock,
  Phone,
  Users,
  LayoutDashboard,
  CheckCircle2,
  UserPlus,
  X,
  BookOpen,
  GraduationCap,
  Loader2,
} from "lucide-react";

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

export default function ParentDashboard() {
  const { user, setUser } = useAuth();
  const vidyaId = user?.vidyaId ?? "";

  const { data: profile, refetch } = useGetProfile(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetProfileQueryKey(vidyaId) },
  });

  const {
    data: linkedData,
    refetch: refetchLinked,
    isLoading: linkedLoading,
  } = useGetLinkedStudents(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetLinkedStudentsQueryKey(vidyaId) },
  });
  const students = linkedData?.students ?? [];

  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");
  const linkMutation = useLinkStudent();
  const unlinkMutation = useUnlinkStudent();

  const handleLinkStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError("");
    setLinkSuccess("");
    const trimmed = linkInput.trim().toUpperCase();
    if (!trimmed) return;
    linkMutation.mutate(
      { vidyaId, data: { studentVidyaId: trimmed } },
      {
        onSuccess: (student) => {
          setLinkSuccess(`${student.name} linked successfully!`);
          setLinkInput("");
          refetchLinked();
        },
        onError: (err) => {
          setLinkError(
            (err as { data?: { error?: string } })?.data?.error ??
              "Could not link student. Please check the ID.",
          );
        },
      },
    );
  };

  const handleUnlink = (studentVidyaId: string, studentName: string) => {
    unlinkMutation.mutate(
      { vidyaId, studentVidyaId },
      {
        onSuccess: () => {
          setLinkSuccess(`${studentName} removed from your account.`);
          refetchLinked();
        },
        onError: () => {
          setLinkError("Failed to remove student. Please try again.");
        },
      },
    );
  };

  const displayed = profile ?? user;

  // Edit Profile dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<"male" | "female">("male");
  const [editContact, setEditContact] = useState("");
  const [editError, setEditError] = useState("");
  const updateMutation = useUpdateProfile();

  const openEdit = () => {
    setEditName(displayed?.name ?? "");
    setEditGender((displayed?.gender as "male" | "female") ?? "male");
    setEditContact(displayed?.contact ?? "");
    setEditError("");
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    updateMutation.mutate(
      {
        vidyaId,
        data: {
          name: editName.trim(),
          gender: editGender,
          contact: editContact.trim() || null,
        },
      },
      {
        onSuccess: (updated) => {
          setUser(updated);
          refetch();
          setEditOpen(false);
        },
        onError: (err) => {
          setEditError(
            (err as { data?: { error?: string } })?.data?.error ?? "Update failed.",
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
              "Failed to change password.",
          );
        },
      },
    );
  };

  if (!displayed) return null;

  const relationship = displayed.parentType === "father" ? "Father" : "Mother";

  return (
    <div className="flex-1 bg-gray-50/50 min-h-full">
      <Tabs defaultValue="profile" className="h-full">
        <div className="border-b bg-white px-6 pt-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-3">Parent Dashboard</h1>
            <TabsList className="bg-transparent p-0 gap-6 border-b-0">
              <TabsTrigger
                value="profile"
                className="px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-semibold"
              >
                My Profile
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-semibold"
              >
                Dashboard
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ── My Profile Tab ── */}
        <TabsContent value="profile" className="mt-0 p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-indigo-700 via-primary to-indigo-500" />
                <CardContent className="px-6 pb-6 -mt-10">
                  <div className="flex items-end justify-between mb-5">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-md border-4 border-white flex items-center justify-center text-primary">
                      <Users className="w-10 h-10" />
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
                        Edit Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openPw}
                        data-testid="button-change-password"
                        className="gap-1.5 rounded-full"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Change Password
                      </Button>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-foreground">{displayed.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono tracking-wide">{displayed.vidyaId}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                    <InfoChip label="Relationship" value={relationship} icon={<User className="w-3.5 h-3.5" />} />
                    <InfoChip label="Gender" value={displayed.gender === "male" ? "Male" : "Female"} />
                    <InfoChip
                      label="Contact"
                      value={displayed.contact ?? "Not provided"}
                      icon={<Phone className="w-3.5 h-3.5" />}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Connected Students */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <UserPlus className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg text-foreground">Connected Students</h3>
                    {students.length > 0 && (
                      <span className="ml-auto text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        {students.length} linked
                      </span>
                    )}
                  </div>

                  {/* Link input */}
                  <form onSubmit={handleLinkStudent} className="flex gap-2 mb-5">
                    <Input
                      value={linkInput}
                      onChange={(e) => {
                        setLinkInput(e.target.value);
                        setLinkError("");
                        setLinkSuccess("");
                      }}
                      placeholder="Enter student's VidyaGanit ID (e.g. VG-STU-12345)"
                      className="h-10 flex-1 font-mono text-sm"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!linkInput.trim() || linkMutation.isPending}
                      className="h-10 px-4 rounded-xl gap-1.5 shrink-0"
                    >
                      {linkMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Link
                    </Button>
                  </form>

                  {linkError && (
                    <p className="text-sm text-red-500 font-medium mb-3 flex items-center gap-1.5">
                      <X className="w-4 h-4 shrink-0" /> {linkError}
                    </p>
                  )}
                  {linkSuccess && (
                    <p className="text-sm text-green-600 font-medium mb-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> {linkSuccess}
                    </p>
                  )}

                  {/* Student list */}
                  {linkedLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">No linked students yet</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Enter your child's VidyaGanit ID above to connect their account.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {students.map((s) => (
                        <div
                          key={s.vidyaId}
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors"
                        >
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <GraduationCap className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.vidyaId}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              {s.studentClass && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <BookOpen className="w-3 h-3" />
                                  Class {s.studentClass}
                                </span>
                              )}
                              {s.board && (
                                <span className="text-xs text-muted-foreground">{s.board}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlink(s.vidyaId, s.name)}
                            disabled={unlinkMutation.isPending}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            title="Remove student"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard" className="mt-0 p-6">
          <div className="max-w-3xl mx-auto flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                <LayoutDashboard className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Future Parent Dashboard</h2>
              <p className="text-muted-foreground max-w-sm">Track your child's progress, view insights, and manage settings here. Coming soon!</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit Profile
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
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
              <Label>Gender</Label>
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
                    {g === "male" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact">Email or Phone</Label>
              <Input
                id="edit-contact"
                data-testid="input-edit-contact"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                placeholder="Email or phone number"
                className="h-11"
              />
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
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ── */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Change Password
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePw} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="parent-current-pw">Current Password</Label>
              <Input
                id="parent-current-pw"
                data-testid="input-current-password"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent-new-pw">New Password</Label>
              <Input
                id="parent-new-pw"
                data-testid="input-new-password"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Use letters, numbers & symbols"
                className="h-11"
                required
              />
              {newPw && (
                <div className="space-y-1.5 mt-1">
                  <span data-testid="text-new-pw-strength" className={`text-sm font-medium ${strength.color}`}>
                    Password Strength: {strength.label}
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
                  Please use a mix of letters, numbers, and symbols to make your password stronger.
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
              {changePwMutation.isPending ? "Updating..." : "Update Password"}
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
