import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useLanguage, LANGUAGES, type Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useUpdateProfile } from "@workspace/api-client-react";
import { LogOut, Languages, Moon, Sun } from "lucide-react";

export default function Header() {
  const { user, setUser, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateProfile();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const handleLanguageChange = (next: Language) => {
    setLang(next);
    if (user) {
      // Persist to the account so the choice follows the family across devices.
      updateProfile.mutate(
        { vidyaId: user.vidyaId, data: { language: next } },
        { onSuccess: (updated) => setUser(updated) },
      );
    }
  };

  const handleSwitchRole = () => {
    if (user) {
      setConfirmLogoutOpen(true);
    } else {
      setLocation("/auth");
    }
  };

  const confirmLogout = () => {
    setConfirmLogoutOpen(false);
    logout();
    setLocation("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-border z-50 flex items-center px-6 justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight transition-transform hover:scale-[1.02]">
          <span className="bg-primary text-white rounded-md w-8 h-8 flex items-center justify-center font-serif text-xl">V</span>
          VidyaGanit
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <span className="hidden sm:block text-sm text-muted-foreground font-medium">
            {t("header.hi")}, {user.name}
          </span>
        )}
        <Select value={lang} onValueChange={(v) => handleLanguageChange(v as Language)}>
          <SelectTrigger
            className="w-auto gap-2 h-9 rounded-full border-border bg-gray-50"
            aria-label={t("language.label")}
            data-testid="select-language"
          >
            <Languages className="w-4 h-4 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code} data-testid={`lang-${l.code}`}>
                {l.native}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          data-testid="button-toggle-theme"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
          className="h-9 w-9 rounded-full border-border bg-gray-50 dark:bg-muted"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-primary" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-switch-role"
          onClick={handleSwitchRole}
          className="font-medium text-foreground rounded-full px-4 gap-2"
        >
          {user ? (
            <>
              <LogOut className="w-4 h-4" />
              {t("header.logout")}
            </>
          ) : (
            t("header.switchRole")
          )}
        </Button>
      </div>

      <AlertDialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <AlertDialogContent className="rounded-2xl" data-testid="dialog-confirm-logout">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logout.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("logout.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-logout" className="rounded-full">
              {t("logout.confirmNo")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              data-testid="button-confirm-logout"
              className="rounded-full"
            >
              {t("logout.confirmYes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
