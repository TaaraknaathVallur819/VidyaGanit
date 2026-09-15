import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { Sparkles, Rocket, Trophy, Target, Star, Smile, Lightbulb, Hexagon } from "lucide-react";
import { useRef } from "react";

// Floating decorative maths symbols
const FloatingSymbol = ({ 
  symbol, 
  delay, 
  xOffset, 
  yOffset, 
  color, 
  size 
}: { 
  symbol: React.ReactNode, 
  delay: number, 
  xOffset: string | number, 
  yOffset: string | number, 
  color: string, 
  size: string 
}) => {
  return (
    <motion.div
      className={`absolute font-black ${color} ${size} select-none pointer-events-none drop-shadow-sm`}
      style={{ left: xOffset, top: yOffset }}
      animate={{
        y: [0, -20, 0],
        rotate: [0, 10, -10, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 4,
        delay: delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {symbol}
    </motion.div>
  );
};

// Floating kid-friendly emoji that gently bobs and sways — adds playful life to
// the page alongside the maths symbols (stars, rocket, pencil, balloon, etc.).
const FloatingEmoji = ({
  emoji,
  delay,
  duration,
  xOffset,
  yOffset,
  size,
}: {
  emoji: string,
  delay: number,
  duration: number,
  xOffset: string | number,
  yOffset: string | number,
  size: string,
}) => {
  return (
    <motion.div
      className={`absolute ${size} select-none pointer-events-none drop-shadow-sm`}
      style={{ left: xOffset, top: yOffset }}
      animate={{
        y: [0, -28, 0],
        x: [0, 10, -10, 0],
        rotate: [0, 8, -8, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      aria-hidden="true"
    >
      {emoji}
    </motion.div>
  );
};

// A twinkling star that pulses in place — scattered sparkle accents.
const TwinkleStar = ({
  delay,
  xOffset,
  yOffset,
  size,
  color,
}: {
  delay: number,
  xOffset: string | number,
  yOffset: string | number,
  size: string,
  color: string,
}) => {
  return (
    <motion.div
      className={`absolute ${size} ${color} select-none pointer-events-none`}
      style={{ left: xOffset, top: yOffset }}
      animate={{
        scale: [0.6, 1.2, 0.6],
        opacity: [0.3, 1, 0.3],
        rotate: [0, 90, 180],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      aria-hidden="true"
    >
      <Sparkles className="w-full h-full" />
    </motion.div>
  );
};

export default function Home() {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center bg-[#f8faff] overflow-hidden relative w-full min-h-screen">
      
      {/* Playful animated background pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: 'radial-gradient(circle at 20px 20px, #6366f1 4px, transparent 0)', 
             backgroundSize: '80px 80px' 
           }} 
      />
      <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none" 
           style={{ 
             backgroundImage: 'radial-gradient(circle at 60px 60px, #f59e0b 3px, transparent 0)', 
             backgroundSize: '80px 80px' 
           }} 
      />

      {/* Magical Floating Symbols */}
      <FloatingSymbol symbol="+" delay={0} xOffset="10%" yOffset="20%" color="text-pink-500" size="text-5xl" />
      <FloatingSymbol symbol="×" delay={1} xOffset="85%" yOffset="15%" color="text-indigo-500" size="text-6xl" />
      <FloatingSymbol symbol="÷" delay={2} xOffset="15%" yOffset="60%" color="text-emerald-500" size="text-5xl" />
      <FloatingSymbol symbol="=" delay={0.5} xOffset="80%" yOffset="70%" color="text-amber-500" size="text-7xl" />
      <FloatingSymbol symbol="π" delay={1.5} xOffset="50%" yOffset="10%" color="text-cyan-500" size="text-5xl" />
      <FloatingSymbol symbol="%" delay={2.5} xOffset="5%" yOffset="40%" color="text-violet-500" size="text-4xl" />

      {/* Playful kid-friendly floaters — a little fun beyond the maths symbols */}
      <FloatingEmoji emoji="🚀" delay={0.3} duration={6} xOffset="88%" yOffset="45%" size="text-5xl" />
      <FloatingEmoji emoji="✏️" delay={1.2} duration={5} xOffset="7%" yOffset="78%" size="text-4xl" />
      <FloatingEmoji emoji="🎈" delay={0.8} duration={7} xOffset="92%" yOffset="82%" size="text-5xl" />
      <FloatingEmoji emoji="🧮" delay={2} duration={6.5} xOffset="22%" yOffset="12%" size="text-4xl" />
      <FloatingEmoji emoji="🌟" delay={1.6} duration={5.5} xOffset="70%" yOffset="30%" size="text-3xl" />
      <FloatingEmoji emoji="📐" delay={2.4} duration={6} xOffset="40%" yOffset="80%" size="text-4xl" />

      {/* Twinkling sparkle accents */}
      <TwinkleStar delay={0} xOffset="30%" yOffset="35%" size="w-6 h-6" color="text-amber-400" />
      <TwinkleStar delay={1} xOffset="65%" yOffset="55%" size="w-5 h-5" color="text-pink-400" />
      <TwinkleStar delay={2} xOffset="48%" yOffset="68%" size="w-7 h-7" color="text-cyan-400" />
      <TwinkleStar delay={1.5} xOffset="78%" yOffset="22%" size="w-5 h-5" color="text-violet-400" />

      {/* Main Hero Content */}
      <motion.div 
        style={{ y: y1 }}
        className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center mt-8 md:mt-16"
      >
        {/* Bouncy Badge */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
          whileHover={{ scale: 1.05, rotate: 3 }}
          className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-white border-2 border-indigo-200 text-indigo-700 text-sm md:text-base font-bold mb-8 shadow-[0_4px_0_0_rgba(199,210,254,1)] cursor-default"
        >
          <Sparkles className="w-5 h-5 text-amber-500 mr-2 animate-pulse" />
          {t("home.badge")}
          <Sparkles className="w-5 h-5 text-amber-500 ml-2 animate-pulse" />
        </motion.div>
        
        {/* Exploding Title */}
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="text-6xl md:text-8xl font-black tracking-tight text-slate-800 leading-[1.1] mb-6"
        >
          {t("home.title1")} <br />
          <motion.span 
            className="relative inline-block mt-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500"
            animate={{ backgroundPosition: ["0% center", "100% center", "0% center"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{ backgroundSize: "200% auto" }}
          >
            {t("home.title2")}
            <motion.svg 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
              className="absolute w-full h-6 -bottom-4 left-0 text-amber-400 drop-shadow-md overflow-visible" 
              viewBox="0 0 100 20" 
              preserveAspectRatio="none"
            >
              <path d="M 0 10 Q 25 20 50 10 T 100 10" stroke="currentColor" strokeWidth="6" fill="transparent" strokeLinecap="round" />
            </motion.svg>
          </motion.span>
        </motion.h1>
        
        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed mt-6 mb-12"
        >
          {t("home.subtitle")}
        </motion.p>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full"
        >
          <Link href="/auth?mode=register" className="w-full sm:w-auto block group">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="w-full sm:w-auto rounded-3xl px-10 h-16 text-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_6px_0_0_rgba(79,70,229,0.5)] hover:shadow-[0_2px_0_0_rgba(79,70,229,0.5)] hover:translate-y-[4px] transition-all border-none">
                <Rocket className="mr-3 w-6 h-6 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                {t("home.createAccount")}
              </Button>
            </motion.div>
          </Link>
          <Link href="/auth?mode=login" className="w-full sm:w-auto block group">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-3xl px-10 h-16 text-xl font-bold border-4 border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 shadow-[0_6px_0_0_rgba(199,210,254,1)] hover:shadow-[0_2px_0_0_rgba(199,210,254,1)] hover:translate-y-[4px] transition-all">
                <Smile className="mr-3 w-6 h-6 text-amber-500" />
                {t("home.login")}
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>

      {/* Decorative Parallax Visuals below fold */}
      <motion.div 
        style={{ y: y2 }}
        className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-32 flex flex-col items-center"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full mt-12">
          {[
            { icon: Trophy, color: "bg-amber-100 text-amber-600 border-amber-200 shadow-amber-200", delay: 0 },
            { icon: Target, color: "bg-emerald-100 text-emerald-600 border-emerald-200 shadow-emerald-200", delay: 0.1 },
            { icon: Star, color: "bg-pink-100 text-pink-600 border-pink-200 shadow-pink-200", delay: 0.2 },
            { icon: Lightbulb, color: "bg-cyan-100 text-cyan-600 border-cyan-200 shadow-cyan-200", delay: 0.3 }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ type: "spring", bounce: 0.5, delay: item.delay }}
              whileHover={{ y: -10, rotate: i % 2 === 0 ? 5 : -5 }}
              className={`flex flex-col items-center justify-center p-8 rounded-3xl border-4 ${item.color} shadow-[0_6px_0_0_currentColor]`}
            >
              <item.icon className="w-16 h-16 mb-4" />
              <div className="flex gap-1">
                {[...Array(3)].map((_, j) => (
                  <Star key={j} className="w-5 h-5 fill-current" />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      {/* Bottom playful wave */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-0">
        <svg className="relative block w-full h-[150px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C50.29,85.12,100.8,61.81,155.6,56.75C210.87,51.72,267.31,65.8,321.39,56.44Z" className="fill-indigo-100/50"></path>
          <path d="M0,0V46.29c47.79,22.2,103.59,32.15,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" className="fill-indigo-50/50 opacity-50"></path>
        </svg>
      </div>
    </div>
  );
}
