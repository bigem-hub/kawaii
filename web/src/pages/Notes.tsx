import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal, EmptyState, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pin, Archive, Star, Trash2, FileText, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface Note {
  id: string;
  title: string;
  content: string;
  contentText: string;
  type: string;
  tags: string;
  pinned: boolean;
  archived: boolean;
  favorite: boolean;
  shareStatus: string;
  createdAt: number;
  updatedAt: number;
}

export default function Notes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | "favorite" | "archived">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("note");

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["notes", filter, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filter === "archived") params.archived = "true";
      else params.archived = "false";
      if (search) params.search = search;
      return api.get(`/notes?${new URLSearchParams(params)}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/notes", { title: newTitle || "Untitled note", type: newType }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note created! ✨");
      setShowAdd(false);
      setNewTitle("");
      window.location.href = `/notes/${data.id}`;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
    },
  });

  const togglePin = async (note: Note) => {
    await api.patch(`/notes/${note.id}`, { pinned: !note.pinned });
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const toggleArchive = async (note: Note) => {
    await api.patch(`/notes/${note.id}`, { archived: !note.archived });
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const toggleFavorite = async (note: Note) => {
    await api.patch(`/notes/${note.id}`, { favorite: !note.favorite });
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const displayNotes = notes || [];

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notes 📒</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> New Note
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-11"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 card overflow-x-auto">
          {(["all", "pinned", "favorite", "archived"] as const).map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-all ${
                filter === f
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : displayNotes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No notes yet"
          message="Create your first note to start capturing ideas!"
          action={
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={18} /> Create Note
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {displayNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Link
                  to={`/notes/${note.id}`}
                  className="block card p-4 hover:shadow-md transition-all hover:-translate-y-0.5 group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {note.type === "quick" ? (
                        <StickyNote size={16} className="text-[var(--accent)]" />
                      ) : (
                        <FileText size={16} className="text-[var(--accent)]" />
                      )}
                      <h3 className="font-bold text-sm truncate flex-1">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          togglePin(note);
                        }}
                        className={`p-1 rounded ${note.pinned ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(note);
                        }}
                        className={`p-1 rounded ${note.favorite ? "text-yellow-500" : "text-[var(--text-muted)]"}`}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleArchive(note);
                        }}
                        className="p-1 rounded text-[var(--text-muted)]"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          deleteMutation.mutate(note.id);
                        }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-3 mb-2">
                    {note.contentText || "Empty note..."}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {note.shareStatus === "shared" && (
                        <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-500/10">Shared</span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{format(new Date(note.updatedAt), "MMM d")}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Note">
        <div className="space-y-4">
          <input className="input" placeholder="Note title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              {["note", "quick", "document", "study"].map((t) => (
                <button
                  key={t}
                  className={`btn-secondary capitalize text-sm ${newType === t ? "ring-2 ring-[var(--accent)]" : ""}`}
                  onClick={() => setNewType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Create
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}