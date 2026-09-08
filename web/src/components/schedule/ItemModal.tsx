import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal, LoadingButton } from "@/components/ui";
import { request, errMessage } from "@/lib/api";
import { formatRs } from "@/lib/currency";
import {
  type ScheduleItem,
  type ScheduleCategory,
  type ScheduleStatus,
  type SchedulePriority,
  type Subtask,
  SCHEDULE_CATEGORIES,
  SCHEDULE_STATUSES,
  PRIORITIES,
  CATEGORY_KEYS,
  newSubtaskId,
} from "@/lib/schedule";

interface Props {
  item: ScheduleItem | null;
  open: boolean;
  onClose: () => void;
  defaultStatus?: ScheduleStatus;
  defaultDate?: string;
  defaultTime?: string;
}

const EMPTY = {
  title: "",
  category: "homework" as ScheduleCategory,
  status: "todo" as ScheduleStatus,
  priority: "medium" as SchedulePriority,
  subjectId: "",
  dueDate: "",
  dueTime: "",
  date: "",
  startTime: "",
  endTime: "",
  tags: [] as string[],
  subtasks: [] as Subtask[],
  progress: 0,
  estimatedMinutes: 0,
  notes: "",
};

export function ItemModal({ item, open, onClose, defaultStatus, defaultDate, defaultTime }: Props) {
  const qc = useQueryClient();
  const isEdit = !!item;
  const [form, setForm] = useState(EMPTY);
  const [tagInput, setTagInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["schedule", "subjects"],
    queryFn: () => request("/api/schedule/subjects"),
  });

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title,
        category: item.category,
        status: item.status,
        priority: item.priority,
        subjectId: item.subjectId ?? "",
        dueDate: item.dueDate ?? "",
        dueTime: item.dueTime ?? "",
        date: item.date ?? "",
        startTime: item.startTime ?? "",
        endTime: item.endTime ?? "",
        tags: [...item.tags],
        subtasks: item.subtasks.map((s) => ({ ...s })),
        progress: item.progress,
        estimatedMinutes: item.estimatedMinutes,
        notes: item.notes,
      });
    } else {
      setForm({
        ...EMPTY,
        status: defaultStatus ?? "todo",
        date: defaultDate ?? "",
        startTime: defaultTime ?? "",
      });
    }
    setTagInput("");
    setNewSubtask("");
  }, [item, open, defaultStatus, defaultDate, defaultTime]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (tag && !form.tags.includes(tag)) {
      set("tags", [...form.tags, tag]);
    }
    setTagInput("");
  }, [tagInput, form.tags]);

  const removeTag = (tag: string) => set("tags", form.tags.filter((t) => t !== tag));

  const addSubtask = useCallback(() => {
    const title = newSubtask.trim();
    if (!title) return;
    set("subtasks", [...form.subtasks, { id: newSubtaskId(), title, completed: false }]);
    setNewSubtask("");
  }, [newSubtask, form.subtasks]);

  const toggleSubtask = (id: string) =>
    set(
      "subtasks",
      form.subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );

  const removeSubtask = (id: string) => set("subtasks", form.subtasks.filter((s) => s.id !== id));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(),
        category: form.category,
        status: form.status,
        priority: form.priority,
        subjectId: form.subjectId || null,
        dueDate: form.dueDate || null,
        dueTime: form.dueTime || null,
        date: form.date || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        tags: form.tags,
        subtasks: form.subtasks,
        progress: form.subtasks.length > 0 ? undefined : form.progress,
        estimatedMinutes: form.estimatedMinutes || 0,
        notes: form.notes,
      };
      if (isEdit) {
        return request(`/api/schedule/items/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return request("/api/schedule/items", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(isEdit ? "Item updated" : "Item created");
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => request(`/api/schedule/items/${item!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Item deleted");
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const canSave = form.title.trim().length > 0 && !saveMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Item" : "New Item"} maxWidth="max-w-2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        {/* Title */}
        <div>
          <label className="label" htmlFor="item-title">Title *</label>
          <input
            id="item-title"
            className="input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
          />
        </div>

        {/* Category + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-category">Category</label>
            <select
              id="item-category"
              className="input"
              value={form.category}
              onChange={(e) => set("category", e.target.value as ScheduleCategory)}
            >
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SCHEDULE_CATEGORIES[k].icon} {SCHEDULE_CATEGORIES[k].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="item-priority">Priority</label>
            <select
              id="item-priority"
              className="input"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as SchedulePriority)}
            >
              {(Object.keys(PRIORITIES) as SchedulePriority[]).map((k) => (
                <option key={k} value={k}>{PRIORITIES[k].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="label" htmlFor="item-status">Status</label>
          <select
            id="item-status"
            className="input"
            value={form.status}
            onChange={(e) => set("status", e.target.value as ScheduleStatus)}
          >
            {SCHEDULE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        {subjects.length > 0 && (
          <div>
            <label className="label" htmlFor="item-subject">Subject</label>
            <select
              id="item-subject"
              className="input"
              value={form.subjectId}
              onChange={(e) => set("subjectId", e.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.shortName ? `(${s.shortName})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Due date + time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-dueDate">Due Date</label>
            <input
              id="item-dueDate"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="item-dueTime">Due Time</label>
            <input
              id="item-dueTime"
              type="time"
              className="input"
              value={form.dueTime}
              onChange={(e) => set("dueTime", e.target.value)}
            />
          </div>
        </div>

        {/* Time-blocking start/end */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-startTime">Start Time</label>
            <input
              id="item-startTime"
              type="time"
              className="input"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="item-endTime">End Time</label>
            <input
              id="item-endTime"
              type="time"
              className="input"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {form.tags.map((tag) => (
              <span key={tag} className="badge text-[11px] bg-[var(--surface-2)] text-[var(--text-muted)]">
                #{tag}
                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500" aria-label={`Remove tag ${tag}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag and press Enter"
            />
            <button onClick={addTag} className="btn-secondary text-xs px-3" type="button">
              Add
            </button>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="label">Subtasks</label>
          <div className="space-y-1 mb-2">
            {form.subtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => toggleSubtask(st.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    st.completed
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                  aria-label={`Toggle ${st.title}`}
                >
                  {st.completed && <span className="text-xs">✓</span>}
                </button>
                <span className={`flex-1 text-sm ${st.completed ? "line-through text-[var(--text-muted)]" : ""}`}>
                  {st.title}
                </span>
                <button
                  onClick={() => removeSubtask(st.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-500"
                  aria-label={`Remove subtask ${st.title}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add subtask and press Enter"
            />
            <button onClick={addSubtask} className="btn-secondary text-xs px-3" type="button">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Estimated minutes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-est">Estimated Minutes</label>
            <input
              id="item-est"
              type="number"
              min={0}
              className="input"
              value={form.estimatedMinutes || ""}
              onChange={(e) => set("estimatedMinutes", parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          {form.subtasks.length === 0 && (
            <div>
              <label className="label" htmlFor="item-progress">Progress (%)</label>
              <input
                id="item-progress"
                type="number"
                min={0}
                max={100}
                className="input"
                value={form.progress}
                onChange={(e) => set("progress", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="label" htmlFor="item-notes">Notes</label>
          <textarea
            id="item-notes"
            className="input min-h-[80px]"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] mt-4">
        {isEdit ? (
          <button
            onClick={() => deleteMutation.mutate()}
            className="btn-danger text-sm"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <LoadingButton
            onClick={() => canSave && saveMutation.mutate()}
            loading={saveMutation.isPending}
            loadingText="Saving..."
            className="btn-primary text-sm"
            disabled={!canSave}
          >
            {isEdit ? "Save Changes" : "Create Item"}
          </LoadingButton>
        </div>
      </div>
    </Modal>
  );
}