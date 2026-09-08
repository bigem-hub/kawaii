import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { PomodoroAmbient } from "@/components/study/PomodoroAmbient";
import { SlashCommandEditor } from "@/components/study/SlashCommandEditor";
import { ExamCountdown, FlashcardWidget, VisualBookshelf } from "@/components/study/StudyWidgets";
import { StudyRoomHub } from "@/components/study/StudyRoomHub";

export default function Study() {
  return (
    <motion.div className="space-y-5 max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-semibold"><GraduationCap size={18} /> Learning workspace</div>
          <h1 className="text-3xl font-bold mt-1">Study Focus</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Plan, focus, review, and keep your next milestone visible.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" to="/tasks"><CheckCircle2 size={16} /> Assignments</Link>
          <Link className="btn-secondary" to="/notes"><BookOpen size={16} /> Notes</Link>
        </div>
      </div>

      <PomodoroAmbient />

      <StudyRoomHub />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SlashCommandEditor />
        <ExamCountdown />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <VisualBookshelf />
        <FlashcardWidget />
      </div>
    </motion.div>
  );
}
