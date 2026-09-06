import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal, EmptyState, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, CheckCircle, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, addDays, startOfWeek, endOfWeek } from "date-fns";

interface EventItem {
  id: string;
  title: string;
  start: number;
  end?: number;
  type: string;
  linkedTaskId?: string | null;
}

interface CombinedData {
  events: EventItem[];
  tasks: any[];
  reminders: any[];
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const { data, isLoading } = useQuery<CombinedData>({
    queryKey: ["calendar", currentMonth],
    queryFn: () => api.get("/calendar/combined"),
  });

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const monthEvents = (data?.events || []).filter((e) => isSameMonth(new Date(e.start), currentMonth));

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success("Event deleted");
    },
  });

  const dayEvents = (data?.events || []).filter((e) => isSameDay(new Date(e.start), selectedDate));
  const dayTasks = (data?.tasks || []).filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), selectedDate));

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar 📅</h1>
        <button className="btn-primary" onClick={() => { setEditingEvent(null); setShowAdd(true); }}>
          <Plus size={18} /> New Event
        </button>
      </div>

      <div className="card p-4">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
          <button className="btn-ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-bold text-lg capitalize">{format(currentMonth, "MMMM yyyy")}</h2>
          <button className="btn-ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-[var(--text-muted)]">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayEvts = monthEvents.filter((e) => isSameDay(new Date(e.start), day));
            const dayT = (data?.tasks || []).filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`h-16 md:h-20 rounded-xl p-1 text-sm flex flex-col items-start justify-start transition-colors ${
                  isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface-2)]"
                } ${!isSameMonth(day, currentMonth) ? "opacity-40" : ""}`}
              >
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday && !isSelected ? "bg-[var(--accent)] text-white" : ""}`}>
                  {format(day, "d")}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-0.5 w-full">
                  {dayEvts.slice(0, 2).map((e) => (
                    <span key={e.id} className={`text-[8px] rounded px-1 truncate w-full ${isSelected ? "bg-white/20" : "bg-blue-100 text-blue-600 dark:bg-blue-500/20"}`}>
                      {e.title}
                    </span>
                  ))}
                  {dayT.length > 0 && (
                    <span className={`text-[8px] rounded px-1 truncate w-full ${isSelected ? "bg-white/20" : "bg-green-100 text-green-600 dark:bg-green-500/20"}`}>
                      {dayT.length} task{dayT.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day details */}
      <div className="card p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <CalendarIcon size={18} className="text-[var(--accent)]" />
          {format(selectedDate, "EEEE, MMMM d")}
        </h3>
        {dayEvents.length === 0 && dayTasks.length === 0 ? (
          <EmptyState icon="🌤️" title="Nothing scheduled" message="Enjoy your free day!" />
        ) : (
          <div className="space-y-2">
            {dayEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Clock size={12} /> {format(new Date(e.start), "h:mm a")}
                  </div>
                </div>
                <button className="p-1.5 text-[var(--text-muted)] hover:text-red-500" onClick={() => deleteEvent.mutate(e.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {dayTasks.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
                <CheckCircle size={16} className={t.completed ? "text-green-500" : "text-[var(--text-muted)]"} />
                <div className="flex-1">
                  <div className={`font-medium text-sm ${t.completed ? "line-through text-[var(--text-muted)]" : ""}`}>{t.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">Task</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Event Modal */}
      <EventModal
        open={showAdd || !!editingEvent}
        onClose={() => { setShowAdd(false); setEditingEvent(null); }}
        event={editingEvent}
        defaultDate={selectedDate}
      />
    </motion.div>
  );
}

function EventModal({ open, onClose, event, defaultDate }: { open: boolean; onClose: () => void; event: EventItem | null; defaultDate: Date }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event?.title || "");
  const [date, setDate] = useState(event ? format(new Date(event.start), "yyyy-MM-dd") : format(defaultDate, "yyyy-MM-dd"));
  const [time, setTime] = useState(event ? format(new Date(event.start), "HH:mm") : "09:00");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(`${date}T${time}`).getTime();
      const payload = { title, start, end: start + 3600000 };
      if (event) return api.patch(`/calendar/events/${event.id}`, payload);
      return api.post("/calendar/events", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(event ? "Event updated!" : "Event created! 🎉");
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit Event" : "New Event"}>
      <div className="space-y-4">
        <input className="input" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={!title.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : event ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}