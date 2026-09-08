import { useState } from "react";
import { Calculator, FileText, Maximize2, Minimize2, StickyNote, X } from "lucide-react";
import { ScientificCalculator } from "@/components/study/ScientificCalculator";
import { VirtualStudyRoom } from "@/components/study/VirtualStudyRoom";

export function StudyRoomHub() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");

  return <section className={expanded ? "fixed inset-3 z-40 overflow-y-auto rounded-3xl bg-[var(--bg)] p-3 md:p-5 shadow-kawaii-lg" : "relative"}>
    <div className="flex items-center justify-between mb-3"><div><div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Collaborative tools</div><h2 className="text-xl font-bold mt-1">Study Room Hub</h2></div>
      <div className="flex items-center gap-2">
        <button className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${calculatorOpen ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)]"}`} onClick={() => setCalculatorOpen((value) => !value)} aria-label="Open calculator"><Calculator size={14} /></button>
        <button className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${notesOpen ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)]"}`} onClick={() => setNotesOpen((value) => !value)} aria-label="Open scratchpad"><StickyNote size={14} /></button>
        <button className="btn-secondary text-xs" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {expanded ? "Exit focus" : "Expand"}</button>
      </div>
    </div>
    <VirtualStudyRoom />
    {calculatorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onMouseDown={() => setCalculatorOpen(false)}><div onMouseDown={(event) => event.stopPropagation()}><ScientificCalculator /></div></div>}
    {notesOpen && <div className="fixed bottom-20 right-5 z-50 w-[min(360px,calc(100vw-2.5rem))] card p-4 shadow-kawaii-lg"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold"><FileText size={16} className="text-[var(--accent)]" /> Scratchpad</div><button className="p-1 text-[var(--text-muted)]" onClick={() => setNotesOpen(false)} aria-label="Close scratchpad"><X size={15} /></button></div><textarea className="input mt-3 min-h-40 resize-y text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Keep a temporary calculation or idea here..." /><div className="text-[10px] text-[var(--text-muted)] mt-2">This scratchpad stays available while the room is open.</div></div>}
  </section>;
}
