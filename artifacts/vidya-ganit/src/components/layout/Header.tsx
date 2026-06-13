import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
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
            Hi, {user.name}
          </span>
        )}
        <div className="hidden sm:flex text-sm text-muted-foreground font-medium border border-border rounded-full px-3 py-1 cursor-default bg-gray-50">
          English / हिंदी / தமிழ்
        </div>
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
              Log Out
            </>
          ) : (
            "Switch Role"
          )}
        </Button>
      </div>
    </header>
  );
}
