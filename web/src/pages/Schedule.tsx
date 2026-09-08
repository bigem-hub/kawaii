import { BookOpen } from "lucide-react";

export default function Schedule() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
      <BookOpen className="w-12 h-12 text-pink-400" />
      <h2 className="text-2xl font-bold text-white">Study Schedule</h2>
      <p className="text-white/50 max-w-sm">
        Your subjects and study timetable will appear here. Coming soon!
      </p>
    </div>
  );
}
