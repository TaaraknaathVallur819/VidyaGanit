import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useLanguage, LANGUAGES } from "@/lib/i18n";
import { LogOut, Languages } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [, setLocation] = useLocation();

  const handleSwitchRole = () => {
    if (user) {
      logout();
      setLocation("/");
    }
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
        <Select value={lang} onValueChange={(v) => setLang(v as typeof lang)}>
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
    </header>
  );
}
