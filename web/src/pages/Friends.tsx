import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { Avatar, EmptyState, Skeleton, Modal } from "@/components/ui";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, UserCheck, UserX, MessageCircle, Globe, Shield, Ban } from "lucide-react";

interface Friend {
  id: string;
  displayName: string;
  username: string;
  avatar: string | null;
  online: boolean;
  lastSeen: number | null;
}

interface FriendRequest {
  id: string;
  fromUser: { id: string; displayName: string; username: string; avatar: string | null };
  createdAt: number;
}

export default function Friends() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"friends" | "requests" | "find">("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends, isLoading: friendsLoading } = useQuery<Friend[]>({
    queryKey: ["friends"],
    queryFn: () => api.get("/friends"),
  });

  const { data: requests } = useQuery<FriendRequest[]>({
    queryKey: ["friendRequests"],
    queryFn: () => api.get("/friends/requests"),
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<any[]>({
    queryKey: ["friendSearch", searchQuery],
    queryFn: () => api.get(`/friends/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
  });

  const sendRequest = useMutation({
    mutationFn: (userId: string) => api.post("/friends/request", { userId }),
    onSuccess: () => {
      toast.success("Friend request sent! 💌");
      queryClient.invalidateQueries({ queryKey: ["friendSearch"] });
    },
  });

  const acceptRequest = useMutation({
    mutationFn: (id: string) => api.post(`/friends/accept/${id}`),
    onSuccess: () => {
      toast.success("Friend added! 🎉");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: (id: string) => api.post(`/friends/reject/${id}`),
    onSuccess: () => {
      toast.success("Request declined");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
  });

  const removeFriend = useMutation({
    mutationFn: (friendId: string) => api.delete(`/friends/${friendId}`),
    onSuccess: () => {
      toast.success("Friend removed");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  if (username) {
    return <ProfileView username={username} />;
  }

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Friends 👥</h1>
      </div>

      <div className="flex gap-1 p-1 card overflow-x-auto">
        {(["friends", "requests", "find"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-all ${
              tab === t ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "requests" && requests && requests.length > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] inline-flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <div className="space-y-3">
          {friendsLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)
          ) : !friends?.length ? (
            <EmptyState icon="👋" title="No friends yet" message="Add some friends to get started!" />
          ) : (
            <AnimatePresence>
              {friends.map((f) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className="cursor-pointer" onClick={() => navigate(`/friends/${f.username}`)}>
                    <Avatar name={f.displayName} avatar={f.avatar} size={44} online={f.online} />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/friends/${f.username}`)}>
                    <div className="font-semibold text-sm">{f.displayName}</div>
                    <div className="text-xs text-[var(--text-muted)]">@{f.username}</div>
                  </div>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => {
                      api.post("/chat/direct", { userId: f.id }).then((conv: any) => {
                        navigate(`/chat/${conv.id}`);
                      });
                    }}
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Remove this friend?")) removeFriend.mutate(f.id);
                    }}
                  >
                    <UserX size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-3">
          {!requests?.length ? (
            <EmptyState icon="📬" title="No pending requests" message="Friend requests will show up here" />
          ) : (
            requests.map((req) => (
              <div key={req.id} className="card p-4 flex items-center gap-3">
                <Avatar name={req.fromUser.displayName} avatar={req.fromUser.avatar} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{req.fromUser.displayName}</div>
                  <div className="text-xs text-[var(--text-muted)]">@{req.fromUser.username}</div>
                </div>
                <button
                  className="btn-primary text-sm !px-3"
                  onClick={() => acceptRequest.mutate(req.id)}
                >
                  <UserCheck size={16} />
                </button>
                <button
                  className="btn-secondary text-sm !px-3"
                  onClick={() => rejectRequest.mutate(req.id)}
                >
                  <UserX size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "find" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              className="input pl-11"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          {searchLoading && <Skeleton className="h-16" />}
          {searchResults && searchResults.length === 0 && (
            <EmptyState icon="🔍" title="No users found" message="Try a different search term" />
          )}
          {searchResults?.map((u: any) => (
            <div key={u.id} className="card p-4 flex items-center gap-3">
              <Avatar name={u.displayName} avatar={u.avatar} size={44} online={u.online} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{u.displayName}</div>
                <div className="text-xs text-[var(--text-muted)]">@{u.username} • Lv.{u.level}</div>
              </div>
              {u.id !== user?.id && (
                <button className="btn-primary text-sm" onClick={() => sendRequest.mutate(u.id)}>
                  <UserPlus size={16} /> Add
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ProfileView({ username }: { username: string }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => api.get(`/users/${username}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!profile) return <EmptyState icon="👤" title="User not found" />;

  const p = profile as any;

  return (
    <motion.div className="max-w-2xl mx-auto space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button className="btn-ghost text-sm" onClick={() => navigate("/friends")}>
        ← Back to friends
      </button>
      <div className="card p-6 text-center">
        <div className="mx-auto w-fit">
          <Avatar name={p.displayName} avatar={p.avatar} size={80} online={p.online} />
        </div>
        <h2 className="text-xl font-bold mt-3">{p.displayName}</h2>
        <p className="text-sm text-[var(--text-muted)]">@{p.username}</p>
        {p.bio && <p className="text-sm mt-2 text-[var(--text-muted)]">{p.bio}</p>}
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="font-bold">{p.stats?.tasks || 0}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Tasks</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{p.stats?.friends || 0}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Friends</div>
          </div>
          <div className="text-center">
            <div className="font-bold">Lv.{p.level || 1}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Level</div>
          </div>
        </div>
        {p.socialLinks?.length > 0 && (
          <div className="flex justify-center gap-3 mt-4">
            {p.socialLinks.map((s: any, i: number) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="badge bg-[var(--surface-2)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {s.platform}
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}