import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, KeyRound, CheckCircle2 } from "lucide-react";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";

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

function RequestResetForm() {
  const [, setLocation] = useLocation();
  const [vidyaId, setVidyaId] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const mutation = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    mutation.mutate(
      { data: { vidyaId: vidyaId.trim(), contact: contact.trim() } },
      {
        onSuccess: (data) => {
          setResult({ type: "success", message: data.message });
        },
        onError: (err) => {
          const msg =
            (err as { data?: { error?: string } })?.data?.error ??
            "We couldn't find an account with those details.";
          setResult({ type: "error", message: msg });
        },
      },
    );
  };

  return (
    <CardContent className="p-8 space-y-6">
      <button
        onClick={() => setLocation("/auth")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-back-to-login"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </button>

      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
          <Mail className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Forgot Password?</h2>
        <p className="text-muted-foreground text-sm">
          Enter your VidyaGanit ID and registered contact to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fp-vidya-id" className="text-foreground font-medium">
            Unique VidyaGanit ID
          </Label>
          <Input
            id="fp-vidya-id"
            data-testid="input-fp-vidya-id"
            value={vidyaId}
            onChange={(e) => setVidyaId(e.target.value)}
            placeholder="e.g. VG-XXX-12345"
            className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fp-contact" className="text-foreground font-medium">
            Email ID / Phone Number
          </Label>
          <Input
            id="fp-contact"
            data-testid="input-fp-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Your registered email or phone"
            className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
            required
          />
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid={result.type === "success" ? "message-fp-success" : "message-fp-error"}
            className={`p-4 rounded-lg text-sm font-medium ${
              result.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {result.message}
          </motion.div>
        )}

        <Button
          type="submit"
          data-testid="button-submit-forgot-password"
          disabled={mutation.isPending}
          className="w-full h-12 text-lg rounded-xl font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? "Checking..." : "Reset Password"}
        </Button>
      </form>
    </CardContent>
  );
}

function ResetForm({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useResetPassword();
  const strength = getPasswordStrength(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate(
      { data: { token, newPassword } },
      {
        onSuccess: () => {
          setDone(true);
        },
        onError: (err) => {
          const msg =
            (err as { data?: { error?: string } })?.data?.error ??
            "This reset link is invalid or has expired. Please request a new one.";
          setError(msg);
        },
      },
    );
  };

  if (done) {
    return (
      <CardContent className="p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Password Reset!</h2>
          <p className="text-muted-foreground text-sm">
            Your password has been updated. You can now log in with your new password.
          </p>
        </div>
        <Button
          type="button"
          data-testid="button-go-to-login"
          onClick={() => setLocation("/auth")}
          className="w-full h-12 text-lg rounded-xl font-semibold bg-primary hover:bg-primary/90"
        >
          Go to Login
        </Button>
      </CardContent>
    );
  }

  return (
    <CardContent className="p-8 space-y-6">
      <button
        onClick={() => setLocation("/auth")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-back-to-login"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </button>

      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
          <KeyRound className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Choose a New Password</h2>
        <p className="text-muted-foreground text-sm">
          Enter a new password for your account below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rp-new-password" className="text-foreground font-medium">
            New Password
          </Label>
          <Input
            id="rp-new-password"
            data-testid="input-rp-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-12 text-lg px-4 bg-gray-50 border-gray-200"
            required
          />
          {newPassword && (
            <div className="space-y-1.5 mt-1">
              <span className={`text-sm font-medium ${strength.color}`}>
                Strength: {strength.label}
              </span>
              <div className="flex gap-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${strength.level >= 1 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                <div className={`h-full transition-all ${strength.level >= 2 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
                <div className={`h-full transition-all ${strength.level >= 3 ? strength.barColor : "bg-transparent"}`} style={{ width: "33.33%" }} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="message-rp-error"
            className="p-4 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-700"
          >
            {error}
          </motion.div>
        )}

        <Button
          type="submit"
          data-testid="button-submit-reset-password"
          disabled={mutation.isPending || newPassword.length < 8}
          className="w-full h-12 text-lg rounded-xl font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? "Resetting..." : "Set New Password"}
        </Button>
      </form>
    </CardContent>
  );
}

export default function ForgotPassword() {
  const token = new URLSearchParams(window.location.search).get("token");

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl rounded-2xl border-0 overflow-hidden">
          {token ? <ResetForm token={token} /> : <RequestResetForm />}
        </Card>
      </motion.div>
    </div>
  );
}
