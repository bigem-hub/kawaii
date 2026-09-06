import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { Avatar, StatCard, ProgressBar, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Edit3, Trophy, Flame, Star, Calendar, CheckCircle, TrendingUp, Medal } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => api.get(`/users/${user?.username}`),
    enabled: !!user?.username,
  });

  const { data: achievements } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get("/notifications/achievements"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch("/auth/profile", data),
    onSuccess: (updated: any) => {
      updateProfile(updated);
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
      toast.success("Profile updated! ✨");
      setIsEditing(false);
    },
  });

  const p = profile as any;

  return (
    <motion.div className="max-w-2xl mx-auto space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Profile Header */}
      <div className="card p-6 text-center relative">
        <div className="flex justify-center">
          <Avatar name={user?.displayName || "?"} avatar={user?.avatar} size={96} />
        </div>
        {isEditing ? (
          <div className="mt-4 space-y-3 max-w-sm mx-auto">
            <input className="input text-center" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <textarea className="input min-h-[60px] resize-none text-center" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write something about yourself..." />
            <div className="flex gap-2 justify-center">
              <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => updateMutation.mutate({ displayName, bio })} disabled={updateMutation.isPending}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mt-3">{user?.displayName}</h2>
            <p className="text-sm text-[var(--text-muted)]">@{user?.username}</p>
            {user?.bio && <p className="text-sm mt-2 text-[var(--text-muted)]">{user.bio}</p>}
            <button className="btn-ghost text-sm mt-2" onClick={() => setIsEditing(true)}>
              <Edit3 size={14} /> Edit Profile
            </button>
          </>
        )}
      </div>

      {/* Level & XP */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Level {user?.level || 1}</h3>
          <span className="text-sm text-[var(--text-muted)]">{user?.xp || 0} XP</span>
        </div>
        <ProgressBar value={((user?.xp || 0) % 100)} />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {100 - ((user?.xp || 0) % 100)} XP to Level {(user?.level || 1) + 1}
        </p>
      </div>

      {/* Stats grid */}
      {p?.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon="🔥" label="Streak" value={`${p.stats.streak || 0} days`} />
          <StatCard icon="✅" label="Tasks Done" value={p.stats.tasks || 0} />
          <StatCard icon="📝" label="Notes" value={p.stats.notes || 0} />
          <StatCard icon="👥" label="Friends" value={p.stats.friends || 0} />
        </div>
      )}

      {/* Streak info */}
      <div className="card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-3"><Flame size={18} className="text-orange-500" /> Streaks</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-500">{user?.streak || 0}</div>
            <div className="text-xs text-[var(--text-muted)]">Current Streak</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">{user?.longestStreak || 0}</div>
            <div className="text-xs text-[var(--text-muted)]">Longest Streak</div>
          </div>
        </div>
        {user?.lastActivityDate && (
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            Last active: {format(new Date(user.lastActivityDate), "MMM d, yyyy")}
          </p>
        )}
      </div>

      {/* Achievements */}
      {achievements && (achievements as any[]).length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold flex items-center gap-2 mb-3"><Medal size={18} className="text-yellow-500" /> Achievements</h3>
          <div className="grid grid-cols-3 gap-3">
            {(achievements as any[]).map((a: any) => (
              <div key={a.id || a.code} className="text-center p-3 rounded-xl bg-[var(--surface-2)]">
                <div className="text-2xl mb-1">{a.icon || "🏅"}</div>
                <div className="text-xs font-semibold">{a.name}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member since */}
      {user?.createdAt && (
        <div className="text-center text-xs text-[var(--text-muted)] pb-4">
          Member since {format(new Date(user.createdAt), "MMMM yyyy")}
        </div>
      )}
    </motion.div>
  );
}