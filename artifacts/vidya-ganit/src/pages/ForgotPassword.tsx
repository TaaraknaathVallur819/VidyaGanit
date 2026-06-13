import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import { useForgotPassword } from "@workspace/api-client-react";

export default function ForgotPassword() {
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
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl rounded-2xl border-0 overflow-hidden">
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
                  placeholder="e.g. VG-PAR-48291"
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
        </Card>
      </motion.div>
    </div>
  );
}
