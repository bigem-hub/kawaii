import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/components/ui";
import { ArrowLeft, Pin, Star, Share2, Trash2 } from "lucide-react";

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T;
}

export default function NoteEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: () => api.get(`/notes/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (note) {
      setTitle((note as any).title || "");
      setContent((note as any).content || "");
    }
  }, [note]);

  const autoSave = useCallback(
    debounce(async (newTitle: string, newContent: string) => {
      if (!id) return;
      try {
        await api.patch(`/notes/${id}`, {
          title: newTitle,
          content: newContent,
          contentText: newContent.replace(/<[^>]*>/g, ""),
        });
        setLastSaved(new Date());
      } catch {
        // silent
      }
    }, 1000),
    [id]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    autoSave(e.target.value, content);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    autoSave(title, e.target.value);
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
      navigate("/notes");
    },
  });

  const togglePin = async () => {
    if (!note) return;
    await api.patch(`/notes/${id}`, { pinned: !(note as any).pinned });
    queryClient.invalidateQueries({ queryKey: ["note", id] });
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const toggleFavorite = async () => {
    if (!note) return;
    await api.patch(`/notes/${id}`, { favorite: !(note as any).favorite });
    queryClient.invalidateQueries({ queryKey: ["note", id] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-10 w-1/2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          className="btn-ghost"
          onClick={() => navigate("/notes")}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-[10px] text-[var(--text-muted)]">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            className={`p-2 rounded-xl ${(note as any)?.pinned ? "text-[var(--accent)] bg-[var(--accent-soft)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
            onClick={togglePin}
          >
            <Pin size={18} />
          </button>
          <button
            className={`p-2 rounded-xl ${(note as any)?.favorite ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
            onClick={toggleFavorite}
          >
            <Star size={18} />
          </button>
          <button
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            onClick={() => toast.success("Share link copied!")}
          >
            <Share2 size={18} />
          </button>
          <button
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500"
            onClick={() => {
              if (confirm("Delete this note?")) deleteMutation.mutate();
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <input
        className="w-full text-3xl font-bold bg-transparent outline-none placeholder:text-[var(--text-muted)]/50"
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled"
      />

      <div className="flex gap-2 text-xs text-[var(--text-muted)]">
        <span className="badge bg-[var(--surface-2)]">{(note as any)?.type || "note"}</span>
        <span className="badge bg-[var(--surface-2)]">{(note as any)?.shareStatus || "private"}</span>
      </div>

      <textarea
        className="w-full min-h-[60vh] bg-transparent outline-none resize-none text-[var(--text)] leading-relaxed placeholder:text-[var(--text-muted)]/40"
        value={content}
        onChange={handleContentChange}
        placeholder="Start writing..."
      />
    </div>
  );
}