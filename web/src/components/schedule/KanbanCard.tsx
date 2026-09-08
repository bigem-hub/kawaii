import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, CalendarDays, GripVertical } from "lucide-react";
import { format } from "date-fns";
import {
  type ScheduleItem,
  categoryInfo,
  priorityInfo,
  deriveProgress,
  isOverdue,
} from "@/lib/schedule";

interface Props {
  item: ScheduleItem;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const cat = categoryInfo(item.category);
  const prio = priorityInfo(item.priority);
  const progress = deriveProgress(item.subtasks, item.progress);
  const overdue = isOverdue(item);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 cursor-grab active:cursor-grabbing shadow-soft hover:shadow-md transition-all ${
        isDragging ? "opacity-60 z-10 rotate-2 scale-[1.02]" : ""
      } ${item.status === "done" ? "opacity-70" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm leading-none pt-0.5" aria-hidden="true">
          {cat.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge text-[10px]" style={{ background: `${cat.color}22`, color: cat.color }}>
              {cat.label}
            </span>
            <span className="badge text-[10px]" style={{ background: prio.bg, color: prio.color }}>
              {prio.label}
            </span>
            {overdue && (
              <span className="badge text-[10px] bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 ml-auto">
                Overdue
              </span>
            )}
          </div>
          <p className={`text-sm font-semibold leading-snug ${item.status === "done" ? "line-through text-[var(--text-muted)]" : ""}`}>
            {item.title}
          </p>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)]">
                  #{tag}
                </span>
              ))}
              {item.tags.length > 3 && <span className="text-[10px] text-[var(--text-muted)]">+{item.tags.length - 3}</span>}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {item.dueDate ? format(new Date(`${item.dueDate}T00:00:00`), "MMM d") : "No date"}
            </span>
            {item.subtasks.length > 0 && (
              <span className="flex items-center gap-1">
                <CheckSquare size={11} />
                {item.subtasks.filter((s) => s.completed).length}/{item.subtasks.length}
              </span>
            )}
          </div>

          {(item.subtasks.length > 0 || progress > 0) && (
            <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress >= 100 ? "#10b981" : "var(--accent)" }}
              />
            </div>
          )}
        </div>
        <GripVertical size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-60 mt-1 shrink-0" />
      </div>
    </div>
  );
}