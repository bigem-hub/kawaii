import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, FileText, CheckCircle, Users, Calendar, Dumbbell, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface SearchResult {
  tasks: any[];
  notes: any[];
  users: any[];
  cardio: any[];
  events: any[];
}

const TABS = [
  { key: "all", label: "All", icon: "🔍" },
  { key: "tasks", label: "Tasks", icon: "✅" },
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "users", label: "Users", icon: "👥" },
  { key: "events", label: "Events", icon: "📅" },
  { key: "cardio", label: "Cardio", icon: "🏃" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");

  const { data: results, isLoading } = useQuery<SearchResult>({
    queryKey: ["search", query],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const filteredResults = results ? {
    tasks: tab === "all" || tab === "tasks" ? results.tasks || [] : [],
    notes: tab === "all" || tab === "notes" ? results.notes || [] : [],
    users: tab === "all" || tab === "users" ? results.users || [] : [],
    events: tab === "all" || tab === "events" ? results.events || [] : [],
    cardio: tab === "all" || tab === "cardio" ? results.cardio || [] : [],
  } : { tasks: [], notes: [], users: [], events: [], cardio: [] };

  const totalResults = Object.values(filteredResults).flat().length;

  return (
    <motion.div className="max-w-3xl mx-auto space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold">Search 🔍</h1>

      <div className="relative">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          className="input pl-12 text-lg py-4"
          placeholder="Search tasks, notes, people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.length >= 2 && (
        <div className="flex gap-1 p-1 card overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.key ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && query.length >= 2 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {query.length < 2 && (
        <EmptyState icon="🔍" title="Search your productivity data" message="Type at least 2 characters to start searching" />
      )}

      {query.length >= 2 && !isLoading && totalResults === 0 && (
        <EmptyState icon="😕" title="No results found" message={`Nothing matched "${query}"`} />
      )}

      {query.length >= 2 && !isLoading && totalResults > 0 && (
        <div className="space-y-6">
          <div className="text-xs text-[var(--text-muted)] font-semibold">
            {totalResults} result{totalResults !== 1 ? "s" : ""} found
          </div>

          {/* Tasks */}
          {filteredResults.tasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-500" /> Tasks</h3>
              {filteredResults.tasks.map((task: any) => (
                <Link key={task.id} to="/tasks" className="block card p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={16} className={task.completed ? "text-green-500" : "text-[var(--text-muted)]"} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${task.completed ? "line-through text-[var(--text-muted)]" : ""}`}>
                        {task.title}
                      </div>
                      {task.dueDate && (
                        <div className="text-xs text-[var(--text-muted)]">Due {format(new Date(task.dueDate), "MMM d")}</div>
                      )}
                    </div>
                    {task.priority !== "none" && (
                      <span className="badge capitalize text-[10px]">{task.priority}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Notes */}
          {filteredResults.notes.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><FileText size={16} className="text-blue-500" /> Notes</h3>
              {filteredResults.notes.map((note: any) => (
                <Link key={note.id} to={`/notes/${note.id}`} className="block card p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{note.title}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{note.contentText}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Users */}
          {filteredResults.users.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><Users size={16} className="text-purple-500" /> People</h3>
              {filteredResults.users.map((u: any) => (
                <Link key={u.id} to={`/friends/${u.username}`} className="block card p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {u.displayName?.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{u.displayName}</div>
                      <div className="text-xs text-[var(--text-muted)]">@{u.username}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Events */}
          {filteredResults.events.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><Calendar size={16} className="text-orange-500" /> Events</h3>
              {filteredResults.events.map((e: any) => (
                <Link key={e.id} to="/calendar" className="block card p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-orange-500" />
                    <div>
                      <div className="font-medium text-sm">{e.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{format(new Date(e.start), "MMM d, h:mm a")}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Cardio */}
          {filteredResults.cardio.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><Dumbbell size={16} className="text-pink-500" /> Cardio</h3>
              {filteredResults.cardio.map((c: any) => (
                <Link key={c.id} to="/fitness" className="block card p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <Dumbbell size={16} className="text-pink-500" />
                    <div>
                      <div className="font-medium text-sm capitalize">{c.type} — {c.distance} km</div>
                      <div className="text-xs text-[var(--text-muted)]">{format(new Date(c.date), "MMM d")}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}