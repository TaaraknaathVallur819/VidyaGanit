import { motion } from "framer-motion";

type Shape = {
  emoji: string;
  left: string;
  top: string;
  size: string;
  duration: number;
  delay: number;
};

const SHAPES: Shape[] = [
  { emoji: "✏️", left: "6%", top: "12%", size: "text-3xl", duration: 7, delay: 0 },
  { emoji: "➕", left: "88%", top: "18%", size: "text-2xl", duration: 6, delay: 0.6 },
  { emoji: "🔢", left: "14%", top: "62%", size: "text-3xl", duration: 8, delay: 1.2 },
  { emoji: "📐", left: "80%", top: "70%", size: "text-2xl", duration: 7.5, delay: 0.3 },
  { emoji: "⭐", left: "46%", top: "8%", size: "text-xl", duration: 6.5, delay: 0.9 },
  { emoji: "✖️", left: "92%", top: "46%", size: "text-2xl", duration: 7, delay: 1.5 },
  { emoji: "🧮", left: "3%", top: "38%", size: "text-3xl", duration: 8.5, delay: 0.4 },
];

/**
 * A soft layer of slowly bobbing maths doodles that sits behind the student
 * dashboard. Purely decorative and `pointer-events-none`, with a handful of
 * elements and a single transform animation each so it stays performant.
 */
export default function FloatingShapes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {SHAPES.map((s, i) => (
        <motion.span
          key={i}
          className={`absolute ${s.size} opacity-[0.13]`}
          style={{ left: s.left, top: s.top }}
          initial={{ y: 0, rotate: -6 }}
          animate={{ y: [0, -14, 0], rotate: [-6, 6, -6] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {s.emoji}
        </motion.span>
      ))}
    </div>
  );
}
