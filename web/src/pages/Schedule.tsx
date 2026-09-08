import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  CalendarDays,
  LayoutGrid,
  List,
  BookOpen,
  Filter,
  X,
} from "lucide-react";
import { request, errMessage } from "@/lib/api";
import {
  type ScheduleItem,
  type ScheduleStatus,
  type ScheduleCategory,
  type SchedulePriority,
  SCHEDULE_CATEGORIES,
  SCHEDULE_STATUSES,
  PRIORITIES,
  CATEGORY_KEYS,
  statusLabel,
} from "@/lib/schedule";
import { KanbanBoard } from "@/components/schedule/KanbanBoard";
import { WeekView } from "@/components/schedule/WeekView";
import { ListView } from "@/components/schedule/ListView";
import { ItemModal } from "@/components/schedule/ItemModal";
import { SubjectManager } from "@/components/schedule/SubjectManager";
import { Spinner } from "@/components/ui";

type View = "kanban" | "week" | "list";

export default function Schedule() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<ScheduleCategory | "">("");
  const [prioFilter, setPrioFilter] = useState<SchedulePriority | "">("");
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<ScheduleStatus | undefined>();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ["schedule", "items"],
    queryFn: () => request("/api/schedule/items"),
  });

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.notes.toLowerCase().includes(q) ||
          i.tags.some((t) => t.includes(q))
      );
    }
    if (catFilter) list = list.filter((i) => i.category === catFilter);
    if (prioFilter) list = list.filter((i) => i.priority === prioFilter);
    if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    return list;
  }, [items, search, catFilter, prioFilter, statusFilter]);

  const openCreate = useCallback(
    (status?: ScheduleStatus, date?: string, time?: string) => {
      setEditItem(null);
      setDefaultStatus(status);
      setDefaultDate(date);
      setDefaultTime(time);
      setModalOpen(true);
    },
    []
  );

  const openEdit = useCallback((item: ScheduleItem | null, status?: ScheduleStatus) => {
    if (item) {
      setEditItem(item);
      setDefaultStatus(undefined);
    } else {
      setEditItem(null);
      setDefaultStatus(status);
    }
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditItem(null);
    setDefaultStatus(undefined);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
  }, []);

  // Toggle status mutation (for list view checkbox)
  const toggleStatusMutation = useMutation({
    mutationFn: (item: ScheduleItem) => {
      const nextStatus: ScheduleStatus = item.status === "done" ? "todo" : item.status === "todo" ? "in_progress" : "done";
      return request(`/api/schedule/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "items"] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  // Kanban drag-and-drop: move item to new status + reorder
  const kanbanMoveMutation = useMutation({
    mutationFn: async ({ item, status, targetIds }: { item: ScheduleItem; status: ScheduleStatus; targetIds: string[] }) => {
      // Update the item's status
      await request(`/api/schedule/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      // Reorder the target column
      await request("/api/schedule/items/reorder", {
        method: "POST",
        body: JSON.stringify({ items: targetIds.map((id, i) => ({ id, sortOrder: i })) }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "items"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  // Kanban reorder within same column
  const kanbanReorderMutation = useMutation({
    mutationFn: (payload: { items: { id: string; sortOrder: number }[] }) =>
      request("/api/schedule/items/reorder", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule", "items"] }),
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleKanbanMove = useCallback(
    (item: ScheduleItem, status: ScheduleStatus, targetIds: string[]) => {
      kanbanMoveMutation.mutate({ item, status, targetIds });
    },
    [kanbanMoveMutation]
  );

  const handleKanbanReorder = useCallback(
    (columnStatus: ScheduleStatus, ids: string[]) => {
      kanbanReorderMutation.mutate({
        items: ids.map((id, i) => ({ id, sortOrder: i })),
      });
    },
    [kanbanReorderMutation]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/api/schedule/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "items"] });
      toast.success("Item deleted");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const activeFilterCount = [catFilter, prioFilter, statusFilter].filter(Boolean).length;

  const VIEW_TABS: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: "kanban", label: "Kanban", icon: <LayoutGrid size={16} /> },
    { key: "week", label: "Week", icon: <CalendarDays size={16} /> },
    { key: "list", label: "List", icon: <List size={16} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-24 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen size={22} className="text-[var(--accent)] shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSubjectModalOpen(true)}
            className="btn-secondary text-sm"
            aria-label="Manage subjects"
          >
            Subjects
          </button>
          <button onClick={() => openCreate()} className="btn-primary text-sm">
            <Plus size={16} /> New Item
          </button>
        </div>
      </div>

      {/* Search + filters bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search items, tags, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search schedule items"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="btn-secondary text-sm sm:hidden"
          aria-expanded={filtersOpen}
        >
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && (
            <span className="bg-[var(--accent)] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Desktop filters (always visible) */}
        <div className={`flex gap-2 ${filtersOpen ? "flex" : "hidden sm:flex"}`}>
          <select
            className="input text-sm w-auto"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as ScheduleCategory | "")}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>{SCHEDULE_CATEGORIES[k].icon} {SCHEDULE_CATEGORIES[k].label}</option>
            ))}
          </select>
          <select
            className="input text-sm w-auto"
            value={prioFilter}
            onChange={(e) => setPrioFilter(e.target.value as SchedulePriority | "")}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            {(Object.keys(PRIORITIES) as SchedulePriority[]).map((k) => (
              <option key={k} value={k}>{PRIORITIES[k].label}</option>
            ))}
          </select>
          <select
            className="input text-sm w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ScheduleStatus | "")}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {SCHEDULE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-[var(--surface-2)]/60 rounded-2xl p-1 w-fit" role="tablist">
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              view === t.key
                ? "bg-[var(--surface)] text-[var(--accent)] shadow-soft"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-8 h-8 text-[var(--accent)]" />
        </div>
      ) : filtered.length === 0 && !search && !catFilter && !prioFilter && !statusFilter ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <CalendarDays size={48} className="text-[var(--accent)]/40" />
          <h3 className="text-lg font-semibold">No schedule items yet</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm">
            Create your first item to start organizing your study schedule, homework, and daily habits.
          </p>
          <button onClick={() => openCreate()} className="btn-primary text-sm">
            <Plus size={16} /> Create First Item
          </button>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard
          items={filtered}
          onOpen={openEdit}
          onMove={handleKanbanMove}
          onReorder={handleKanbanReorder}
        />
      ) : view === "week" ? (
        <div className="card p-2 sm:p-4">
          <WeekView
            items={filtered}
            onOpen={openEdit}
            onSlotClick={(date, time) => openCreate("todo", date, time)}
          />
        </div>
      ) : (
        <div className="card p-2 sm:p-4">
          <ListView
            items={filtered}
            onOpen={openEdit}
            onToggleStatus={(item) => toggleStatusMutation.mutate(item)}
            onDelete={(id) => {
              if (confirm("Delete this item?")) deleteMutation.mutate(id);
            }}
          />
        </div>
      )}

      {/* Modals */}
      <ItemModal
        item={editItem}
        open={modalOpen}
        onClose={closeModal}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
      />
      <SubjectManager open={subjectModalOpen} onClose={() => setSubjectModalOpen(false)} />
    </div>
  );
}