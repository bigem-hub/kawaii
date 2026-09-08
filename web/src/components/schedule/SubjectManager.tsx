import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Palette } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal, LoadingButton } from "@/components/ui";
import { request, errMessage } from "@/lib/api";
import { type Subject } from "@/lib/schedule";

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#F7DC6F", "#BB8FCE", "#2ECC71",
  "#3498DB", "#E67E22", "#1ABC9C", "#E74C3C", "#9B59B6",
  "#34495E", "#16A085", "#F39C12", "#D35400", "#8E44AD",
];

export function SubjectManager({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["schedule", "subjects"],
    queryFn: () => request("/api/schedule/subjects"),
    enabled: open,
  });

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editing, setEditing] = useState<Subject | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setShortName(editing.shortName ?? "");
      setTeacher(editing.teacher ?? "");
      setRoom(editing.room ?? "");
      setColor(editing.color);
    } else {
      setName("");
      setShortName("");
      setTeacher("");
      setRoom("");
      setColor(COLORS[0]);
    }
  }, [editing, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), shortName: shortName.trim() || null, teacher: teacher.trim() || null, room: room.trim() || null, color };
      if (editing) {
        return request(`/api/schedule/subjects/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return request("/api/schedule/subjects", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "subjects"] });
      toast.success(editing ? "Subject updated" : "Subject added");
      setEditing(null);
      setName(""); setShortName(""); setTeacher(""); setRoom(""); setColor(COLORS[0]);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/api/schedule/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", "subjects"] });
      toast.success("Subject deleted");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const canSave = name.trim().length > 0 && !saveMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Subject" : "Manage Subjects"} maxWidth="max-w-md">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Existing subjects list */}
        {subjects.length > 0 && (
          <div className="space-y-2 mb-4">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50"
              >
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate block">{s.name}</span>
                  {s.teacher && <span className="text-[11px] text-[var(--text-muted)]">{s.teacher}</span>}
                </div>
                <button
                  onClick={() => setEditing(s)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-muted)]"
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-500"
                  aria-label={`Delete ${s.name}`}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        <div className="space-y-3 pt-3 border-t border-[var(--border)]">
          <h4 className="text-sm font-semibold">{editing ? "Edit Subject" : "Add New Subject"}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="subj-name">Name *</label>
              <input
                id="subj-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label className="label" htmlFor="subj-short">Short Name</label>
              <input
                id="subj-short"
                className="input"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. MATH"
                maxLength={6}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="subj-teacher">Teacher</label>
              <input
                id="subj-teacher"
                className="input"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="e.g. Mr. Smith"
              />
            </div>
            <div>
              <label className="label" htmlFor="subj-room">Room</label>
              <input
                id="subj-room"
                className="input"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Palette size={14} /> Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-[var(--text)] scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editing && (
              <button
                onClick={() => setEditing(null)}
                className="btn-secondary text-sm"
              >
                Cancel Edit
              </button>
            )}
            <LoadingButton
              onClick={() => canSave && saveMutation.mutate()}
              loading={saveMutation.isPending}
              loadingText="Saving..."
              className="btn-primary text-sm"
              disabled={!canSave}
            >
              {editing ? "Update Subject" : "Add Subject"}
            </LoadingButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}