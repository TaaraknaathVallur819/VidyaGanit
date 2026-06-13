import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Users } from "lucide-react";

type Mode = "login" | "register";
type Role = "student" | "parent";
type Gender = "male" | "female";
type ParentType = "father" | "mother";
type StudentClass = "4" | "5" | "6" | "7";

const TAKEN_NAMES = ["arjun", "priya", "rohan", "anjali", "vikram", "meera", "riya", "aarav"];

function TileButton({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-muted bg-white text-muted-foreground hover:border-primary/30"
      }`}
    >
      {children}
    </button>
  );
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialMode = (searchParams.get("mode") as Mode) || "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("student");

  // Login State
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register State
  const [regName, setRegName] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [parentType, setParentType] = useState<ParentType | null>(null);
  const [studentClass, setStudentClass] = useState<StudentClass | null>(null);

  useEffect(() => {
    if (regName) {
      if (TAKEN_NAMES.includes(regName.toLowerCase().trim())) {
        setNameError("Username is taken already, please try a different one");
      } else {
        setNameError("");
      }
    } else {
      setNameError("");
    }
  }, [regName]);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: "", color: "", barColor: "", level: 0 };

    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /[0-9]/.test(pwd);
    const hasSymbols = /[^a-zA-Z0-9]/.test(pwd);
    const isLongEnough = pwd.length >= 8;

    if (!isLongEnough || (hasLetters && !hasNumbers && !hasSymbols)) {
      return { label: "Weak", color: "text-red-500", barColor: "bg-red-500", level: 1 };
    }

    if (isLongEnough && !(hasLetters && hasNumbers && hasSymbols)) {
      return { label: "Medium", color: "text-orange-500", barColor: "bg-orange-500", level: 2 };
    }

    if (isLongEnough && hasLetters && hasNumbers && hasSymbols) {
      return { label: "Strong", color: "text-green-500", barColor: "bg-green-500", level: 3 };
    }

    return { label: "Weak", color: "text-red-500", barColor: "bg-red-500", level: 1 };
  };

  const strength = getPasswordStrength(regPassword);

  const isRegisterValid =
    !nameError &&
    regPassword &&
    strength.level === 3 &&
    gender !== null &&
    (role === "student" ? studentClass !== null : parentType !== null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginId.toUpperCase().startsWith("VG-STU-")) {
      setLocation("/dashboard/student");
    } else if (loginId.toUpperCase().startsWith("VG-PAR-")) {
      setLocation("/dashboard/parent");
    } else {
      alert("Invalid ID prefix. Must start with VG-STU- or VG-PAR-");
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegisterValid) return;

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newId = role === "student" ? `VG-STU-${randomNum}` : `VG-PAR-${randomNum}`;

    setLocation(`/success?id=${newId}&role=${role}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-md shadow-xl rounded-2xl overflow-hidden border-0">
        <div className="flex w-full bg-muted/50 p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${mode === "login" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Log In
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${mode === "register" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Create Account
          </button>
        </div>

        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-6"
              >
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
                  <p className="text-muted-foreground text-sm">Enter your VidyaGanit ID to continue learning.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-id" className="text-foreground font-medium">Unique VidyaGanit ID</Label>
                    <Input
                      id="login-id"
                      data-testid="input-login-id"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="e.g. VG-STU-12345"
                      className="h-12 text-lg px-4 bg-gray-50 border-gray-200 focus-visible:ring-primary focus-visible:ring-offset-2"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-foreground font-medium">Password</Label>
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" data-testid="button-submit-login" className="w-full h-12 text-lg rounded-xl font-semibold mt-6 bg-primary hover:bg-primary/90">
                  Log In
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-5"
              >
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Join VidyaGanit</h2>
                  <p className="text-muted-foreground text-sm">Select your role to get started.</p>
                </div>

                {/* Role tiles */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    data-testid="tile-role-student"
                    onClick={() => setRole("student")}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${role === "student" ? "border-primary bg-primary/5 text-primary" : "border-muted bg-white text-muted-foreground hover:border-primary/30"}`}
                  >
                    <UserCircle className="w-8 h-8" />
                    <span className="font-semibold">I am a Student</span>
                  </button>
                  <button
                    type="button"
                    data-testid="tile-role-parent"
                    onClick={() => setRole("parent")}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${role === "parent" ? "border-primary bg-primary/5 text-primary" : "border-muted bg-white text-muted-foreground hover:border-primary/30"}`}
                  >
                    <Users className="w-8 h-8" />
                    <span className="font-semibold">I am a Parent</span>
                  </button>
                </div>

                {/* Parent type: Father / Mother */}
                {role === "parent" && (
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium">I am a</Label>
                    <div className="flex gap-3">
                      <TileButton
                        selected={parentType === "father"}
                        onClick={() => setParentType("father")}
                        testId="tile-parent-father"
                      >
                        Father
                      </TileButton>
                      <TileButton
                        selected={parentType === "mother"}
                        onClick={() => setParentType("mother")}
                        testId="tile-parent-mother"
                      >
                        Mother
                      </TileButton>
                    </div>
                  </div>
                )}

                {/* Student class selection */}
                {role === "student" && (
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium">My Class</Label>
                    <div className="flex gap-3">
                      {(["4", "5", "6", "7"] as StudentClass[]).map((cls) => (
                        <TileButton
                          key={cls}
                          selected={studentClass === cls}
                          onClick={() => setStudentClass(cls)}
                          testId={`tile-class-${cls}`}
                        >
                          Class {cls}
                        </TileButton>
                      ))}
                    </div>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-foreground font-medium">Full Name</Label>
                  <Input
                    id="reg-name"
                    data-testid="input-register-name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rohan Sharma"
                    className={`h-12 text-lg px-4 bg-gray-50 ${nameError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200"}`}
                    required
                  />
                  {nameError && (
                    <p data-testid="error-name-taken" className="text-sm text-red-500 font-medium mt-1">{nameError}</p>
                  )}
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label className="text-foreground font-medium">Gender</Label>
                  <div className="flex gap-3">
                    <TileButton
                      selected={gender === "male"}
                      onClick={() => setGender("male")}
                      testId="tile-gender-male"
                    >
                      Male
                    </TileButton>
                    <TileButton
                      selected={gender === "female"}
                      onClick={() => setGender("female")}
                      testId="tile-gender-female"
                    >
                      Female
                    </TileButton>
                  </div>
                </div>

                {/* Parent contact */}
                {role === "parent" && (
                  <div className="space-y-2">
                    <Label htmlFor="reg-contact" className="text-foreground font-medium">Email or Phone</Label>
                    <Input
                      id="reg-contact"
                      data-testid="input-register-contact"
                      value={regContact}
                      onChange={(e) => setRegContact(e.target.value)}
                      placeholder="Email or Phone"
                      className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
                      required
                    />
                  </div>
                )}

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-foreground font-medium">Create Password</Label>
                  <Input
                    id="reg-password"
                    data-testid="input-register-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Use letters, numbers & symbols"
                    className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
                    required
                  />

                  {regPassword && (
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span data-testid="text-password-strength" className={strength.color}>
                          Password Strength: {strength.label}
                        </span>
                      </div>
                      <div className="flex gap-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${strength.level >= 1 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                        <div className={`h-full transition-all duration-300 ${strength.level >= 2 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                        <div className={`h-full transition-all duration-300 ${strength.level >= 3 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                      </div>
                    </div>
                  )}
                </div>

                {regPassword && strength.level < 3 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 leading-relaxed">
                    To keep your VidyaGanit account completely safe, your password needs to be a bit stronger! Please try a different password using letters, numbers, and symbols.
                  </div>
                )}

                <Button
                  type="submit"
                  data-testid="button-submit-register"
                  disabled={!isRegisterValid}
                  className="w-full h-12 text-lg rounded-xl font-semibold mt-2 bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Account
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
