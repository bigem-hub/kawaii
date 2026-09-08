import { useMemo } from "react";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";
import { type ScheduleItem, categoryInfo, deriveProgress } from "@/lib/schedule";

interface Props {
  items: ScheduleItem[];
  onOpen: (item: ScheduleItem) => void;
  onSlotClick: (date: string, time: string) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00–20:00
const HOUR_HEIGHT = 56; // px per hour row

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function positionStyle(start: string, end: string) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const top = ((s - 480) / 60) * HOUR_HEIGHT; // 480 = 8:00 in minutes
  const height = Math.max(((e - s) / 60) * HOUR_HEIGHT, 24);
  return { top: `${top}px`, height: `${height}px` };
}

export function WeekView({ items, onOpen, onSlotClick }: Props) {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const timedItems = useMemo(() => {
    return items.filter((i) => i.date && i.startTime && i.endTime);
  }, [items]);

  const allDayItems = useMemo(() => {
    return items.filter((i) => i.date && (!i.startTime || !i.endTime));
  }, [items]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--border)]">
          <div className="p-2" />
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`p-2 text-center text-xs font-semibold ${isToday ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
              >
                <div>{format(day, "EEE")}</div>
                <div className={`text-lg mt-0.5 ${isToday ? "bg-[var(--accent)] text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day strip */}
        {allDayItems.length > 0 && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--border)] min-h-[36px]">
            <div className="p-1 text-[10px] text-[var(--text-muted)] flex items-center justify-center">All day</div>
            {days.map((day) => {
              const dayItems = allDayItems.filter((i) => i.date === format(day, "yyyy-MM-dd"));
              return (
                <div key={day.toISOString()} className="p-1 flex flex-wrap gap-1">
                  {dayItems.map((item) => {
                    const cat = categoryInfo(item.category);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onOpen(item)}
                        className="text-[10px] px-2 py-0.5 rounded-lg truncate max-w-full hover:opacity-80 transition-opacity cursor-pointer"
                        style={{ background: `${cat.color}22`, color: cat.color, borderLeft: `3px solid ${cat.color}` }}
                        title={item.title}
                      >
                        {cat.icon} {item.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Time grid */}
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Hour labels + grid lines */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="text-[10px] text-[var(--text-muted)] text-right pr-2 -mt-2" style={{ height: HOUR_HEIGHT }}>
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((day) => (
                <div
                  key={`${hour}-${day.toISOString()}`}
                  className="border-b border-[var(--border)]/50 hover:bg-[var(--accent-soft)]/30 cursor-pointer transition-colors"
                  style={{ height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick(format(day, "yyyy-MM-dd"), `${String(hour).padStart(2, "0")}:00`)}
                />
              ))}
            </div>
          ))}

          {/* Positioned timed items */}
          {timedItems.map((item) => {
            const dayIndex = days.findIndex((d) => item.date === format(d, "yyyy-MM-dd"));
            if (dayIndex < 0) return null;
            const cat = categoryInfo(item.category);
            const style = positionStyle(item.startTime!, item.endTime!);
            const progress = deriveProgress(item.subtasks, item.progress);
            return (
              <button
                key={item.id}
                onClick={() => onOpen(item)}
                className="absolute rounded-xl px-2 py-1 text-left overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-sm border"
                style={{
                  left: `calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 4px)`,
                  width: `calc((100% - 60px) / 7 - 8px)`,
                  top: style.top,
                  height: style.height,
                  background: `${cat.color}18`,
                  borderColor: `${cat.color}40`,
                  zIndex: 10,
                }}
                title={`${item.title} — ${item.startTime}–${item.endTime}`}
              >
                <div className="text-[11px] font-semibold truncate" style={{ color: cat.color }}>
                  {cat.icon} {item.title}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {item.startTime}–{item.endTime}
                </div>
                {progress > 0 && (
                  <div className="h-1 rounded-full bg-[var(--surface-2)] mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}