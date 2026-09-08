import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { Modal, EmptyState, Tag, ProgressBar, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Filter,
  Search,
  Calendar,
  CheckCircle,
  Circle,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Flame,
  Star,
} from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string;
  notes: string;
  priority: string;
  status: string;
  completed: boolean;
  completedAt?: number;
  dueDate?: number;
  tags: string;
  recurring: string;
  reminderAt?: number;
  sortOrder: number;
  subtasks: Subtask[];
  categoryId?: string;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

const VIEWS = ["Today", "Active", "Overdue", "Completed", "All"] as const;
const PRIORITIES = [
  { value: "high", label: "High", color: "#ef4444" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "low", label: "Low", color: "#22c55e" },
  { value: "none", label: "None", color: "#94a3b8" },
];

export default function Tasks() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [view, setView] = useState<string>("Active");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", view],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (view === "Today") params.view = "today";
      else if (view === "Active") params.status = "active";
      else if (view === "Completed") params.status = "completed";
      else if (view === "Overdue") params.view = "overdue";
      if (search) params.search = search;
      return api.get(`/tasks?${new URLSearchParams(params)}`);
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["taskStats"],
    queryFn: () => api.get("/tasks/stats"),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) =>
      api.patch(`/tasks/${task.id}`, { completed: !task.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["taskStats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refreshUser();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
  });

  const toggleSubtask = async (taskId: string, subtask: Subtask) => {
    await api.patch(`/tasks/${taskId}/subtasks/${subtask.id}`, {
      completed: !subtask.completed,
    });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const addSubtask = async (taskId: string) => {
    await api.post(`/tasks/${taskId}/subtasks`, { title: "New subtask" });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const filteredTasks = tasks || [];

  const getPriorityColor = (p: string) =>
    PRIORITIES.find((pr) => pr.value === p)?.color || "#94a3b8";

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks ✅</h1>
        <button className="btn-primary" onClick={() => { setEditingTask(null); setShowAdd(true); }}>
          <Plus size={18} /> New
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold">{(stats as any).completedToday || 0}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Done today</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold">{(stats as any).pending || 0}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Pending</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold">{(stats as any).weeklyRate || 0}%</div>
            <div className="text-[10px] text-[var(--text-muted)]">Weekly rate</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Flame size={16} className="text-orange-500" />
              {(stats as any).streak || 0}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">Day streak</div>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-11"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 card overflow-x-auto">
          {VIEWS.map((v) => (
            <button
              key={v}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                view === v
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              }`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon="📝"
          title={view === "Completed" ? "No completed tasks yet" : "No tasks here"}
          message="Start adding tasks to boost your productivity!"
          action={
            <button className="btn-primary" onClick={() => { setEditingTask(null); setShowAdd(true); }}>
              <Plus size={18} /> Add Task
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => toggleMutation.mutate(task)}
                  >
                    {task.completed ? (
                      <CheckCircle size={22} className="text-green-500" />
                    ) : (
                      <Circle
                        size={22}
                        className="border-2 hover:border-[var(--accent)] transition-colors"
                        style={{ borderColor: getPriorityColor(task.priority) }}
                      />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-semibold text-sm ${
                        task.completed ? "line-through text-[var(--text-muted)]" : ""
                      }`}
                    >
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {task.dueDate && (
                        <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                          <Calendar size={10} />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                      {task.priority !== "none" && (
                        <span
                          className="badge"
                          style={{ background: `${getPriorityColor(task.priority)}22`, color: getPriorityColor(task.priority) }}
                        >
                          {task.priority}
                        </span>
                      )}
                      {task.recurring !== "none" && (
                        <span className="badge bg-purple-50 text-purple-600 dark:bg-purple-500/10">
                          {task.recurring}
                        </span>
                      )}
                    </div>
                    {task.subtasks.length > 0 && (
                      <div className="mt-2">
                        <ProgressBar
                          value={
                            (task.subtasks.filter((s) => s.completed).length /
                              task.subtasks.length) *
                            100
                          }
                        />
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
                      onClick={() => setEditingTask(task)}
                    >
                      ✏️
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500"
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {/* Subtask expand */}
                {task.subtasks.length > 0 && (
                  <div className="mt-3 ml-8">
                    <button
                      className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    >
                      {expandedTask === task.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {task.subtasks.length} subtasks
                    </button>
                    <AnimatePresence>
                      {expandedTask === task.id && (
                        <motion.div
                          className="mt-2 space-y-1"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          {task.subtasks.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 pl-2">
                              <button onClick={() => toggleSubtask(task.id, sub)}>
                                {sub.completed ? (
                                  <CheckCircle size={14} className="text-green-500" />
                                ) : (
                                  <Circle size={14} className="border-2 border-[var(--text-muted)]" />
                                )}
                              </button>
                              <span
                                className={`text-sm ${
                                  sub.completed ? "line-through text-[var(--text-muted)]" : ""
                                }`}
                              >
                                {sub.title}
                              </span>
                            </div>
                          ))}
                          <button
                            className="text-xs text-[var(--accent)] hover:underline mt-1"
                            onClick={() => addSubtask(task.id)}
                          >
                            + Add subtask
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Modal */}
      <TaskModal
        open={showAdd || !!editingTask}
        onClose={() => { setShowAdd(false); setEditingTask(null); }}
        task={editingTask}
      />
    </motion.div>
  );
}

function TaskModal({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "none");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""
  );
  const [recurring, setRecurring] = useState(task?.recurring || "none");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        recurring,
      };
      if (task) {
        return api.patch(`/tasks/${task.id}`, payload);
      }
      return api.post("/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["taskStats"] });
      toast.success(task ? "Task updated!" : "Task created! ✨");
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={task ? "Edit Task" : "New Task"}>
      <div className="space-y-4">
        <input
          className="input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="input min-h-[80px] resize-none"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Priority</label>
            <select
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Recurring</label>
          <select
            className="input"
            value={recurring}
            onChange={(e) => setRecurring(e.target.value)}
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : task ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}