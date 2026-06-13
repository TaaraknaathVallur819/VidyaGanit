import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-border z-50 flex items-center px-6 justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight transition-transform hover:scale-[1.02]">
          <span className="bg-primary text-white rounded-md w-8 h-8 flex items-center justify-center font-serif text-xl">V</span>
          VidyaGanit
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex text-sm text-muted-foreground font-medium border border-border rounded-full px-3 py-1 cursor-default bg-gray-50">
          English / हिंदी / தமிழ்
        </div>
        <Button variant="outline" size="sm" className="font-medium text-foreground rounded-full px-4">
          Switch Role
        </Button>
      </div>
    </header>
  );
}
