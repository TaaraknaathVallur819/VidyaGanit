import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50/50 to-white overflow-hidden relative w-full h-full p-6">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-3xl w-full text-center z-10 space-y-8"
      >
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-secondary/15 text-foreground text-sm font-semibold mb-2">
          <span className="w-2 h-2 rounded-full bg-secondary mr-2" />
          {t("home.badge")}
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
          {t("home.title1")} <br />
          <span className="text-primary relative inline-block mt-2">
            {t("home.title2")}
            <svg className="absolute w-full h-3 -bottom-1 left-0 text-secondary opacity-70" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="transparent" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t("home.subtitle")}
        </p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-8"
        >
          <Link href="/auth?mode=register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full px-8 h-14 text-lg bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all">
              {t("home.createAccount")}
            </Button>
          </Link>
          <Link href="/auth?mode=login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-14 text-lg border-2 hover:bg-muted/50 transition-all">
              {t("home.login")}
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
