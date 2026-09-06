import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)]">
      <motion.div
        className="text-6xl mb-4"
        animate={{ y: [0, -10, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        🌸
      </motion.div>
      <div className="text-[var(--text-muted)] font-semibold">
        KawaiiLife is waking up...
      </div>
    </div>
  );
}