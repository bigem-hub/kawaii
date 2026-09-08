import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  type ScheduleItem,
  type ScheduleStatus,
  categoryInfo,
  priorityInfo,
  deriveProgress,
  isOverdue,
  statusLabel,
} from "@/lib/schedule";

interface Props {
  items: ScheduleItem[];
  onOpen: (item: ScheduleItem) => void;
  onToggleStatus: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}

type SortKey = "title" | "category" | "priority" | "dueDate" | "status";

const SORT_ICONS: Record<SortKey, string> = {
  title: "Aa",
  category: "📁",
  priority: "🔥",
  dueDate: "📅",
  status: "📊",
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { todo: 0, in_progress: 1, done: 2 };

export function ListView({ items, onOpen, onToggleStatus, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "category":
        cmp = a.category.localeCompare(b.category);
        break;
      case "priority":
        cmp = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        break;
      case "dueDate":
        cmp = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        break;
      case "status":
        cmp = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const StatusIcon = ({ status }: { status: ScheduleStatus }) => {
    if (status === "done") return <CheckCircle2 size={18} className="text-green-500" />;
    if (status === "in_progress") return <Clock size={18} className="text-amber-500" />;
    return <Circle size={18} className="text-[var(--text-muted)]" />;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm" role="grid">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="text-left p-2 w-10" />
            <th className="text-left p-2">
              <button className="flex items-center gap-1 hover:text-[var(--text)]" onClick={() => toggleSort("title")}>
                Title <SortIcon col="title" />
              </button>
            </th>
            <th className="text-left p-2 hidden sm:table-cell">
              <button className="flex items-center gap-1 hover:text-[var(--text)]" onClick={() => toggleSort("category")}>
                Category <SortIcon col="category" />
              </button>
            </th>
            <th className="text-left p-2 hidden md:table-cell">
              <button className="flex items-center gap-1 hover:text-[var(--text)]" onClick={() => toggleSort("priority")}>
                Priority <SortIcon col="priority" />
              </button>
            </th>
            <th className="text-left p-2 hidden md:table-cell">
              <button className="flex items-center gap-1 hover:text-[var(--text)]" onClick={() => toggleSort("dueDate")}>
                Due <SortIcon col="dueDate" />
              </button>
            </th>
            <th className="text-left p-2 hidden lg:table-cell">
              <button className="flex items-center gap-1 hover:text-[var(--text)]" onClick={() => toggleSort("status")}>
                Status <SortIcon col="status" />
              </button>
            </th>
            <th className="text-right p-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-[var(--text-muted)] py-12">
                No items found. Try adjusting your filters or add a new item.
              </td>
            </tr>
          )}
          {sorted.map((item) => {
            const cat = categoryInfo(item.category);
            const prio = priorityInfo(item.priority);
            const overdue = isOverdue(item);
            const progress = deriveProgress(item.subtasks, item.progress);
            return (
              <tr
                key={item.id}
                className={`border-b border-[var(--border)]/50 hover:bg-[var(--surface-2)]/50 transition-colors ${
                  item.status === "done" ? "opacity-60" : ""
                }`}
              >
                <td className="p-2">
                  <button
                    onClick={() => onToggleStatus(item)}
                    className="p-1 rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                    aria-label={`Mark ${item.status === "done" ? "incomplete" : "complete"}`}
                  >
                    <StatusIcon status={item.status} />
                  </button>
                </td>
                <td className="p-2">
                  <button
                    onClick={() => onOpen(item)}
                    className="text-left hover:text-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <span className={`font-semibold ${item.status === "done" ? "line-through" : ""}`}>
                      {item.title}
                    </span>
                    {item.subtasks.length > 0 && (
                      <span className="text-[11px] text-[var(--text-muted)] ml-2">
                        {item.subtasks.filter((s) => s.completed).length}/{item.subtasks.length}
                      </span>
                    )}
                    {progress > 0 && progress < 100 && (
                      <div className="h-1 rounded-full bg-[var(--surface-2)] mt-1 w-24 overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </button>
                </td>
                <td className="p-2 hidden sm:table-cell">
                  <span
                    className="badge text-[10px]"
                    style={{ background: `${cat.color}22`, color: cat.color }}
                  >
                    {cat.icon} {cat.label}
                  </span>
                </td>
                <td className="p-2 hidden md:table-cell">
                  <span
                    className="badge text-[10px]"
                    style={{ background: prio.bg, color: prio.color }}
                  >
                    {prio.label}
                  </span>
                </td>
                <td className="p-2 hidden md:table-cell">
                  {item.dueDate ? (
                    <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : ""}`}>
                      {overdue && <AlertTriangle size={12} />}
                      {format(new Date(`${item.dueDate}T00:00:00`), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td className="p-2 hidden lg:table-cell">
                  <span className="text-xs text-[var(--text-muted)]">{statusLabel(item.status)}</span>
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onOpen(item)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] cursor-pointer"
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}