import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal, EmptyState, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Plus, Play, Users, Copy, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface WatchRoom {
  id: string;
  code: string;
  name: string;
  mediaUrl?: string;
  mediaTitle?: string;
  mediaProvider?: string;
  privacy: string;
  hostId: string;
  members: any[];
  memberCount?: number;
  createdAt: number;
}

export default function WatchTogether() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const { data: rooms, isLoading } = useQuery<WatchRoom[]>({
    queryKey: ["watchRooms"],
    queryFn: () => api.get("/watch/rooms"),
  });

  const { data: myRooms } = useQuery<WatchRoom[]>({
    queryKey: ["myWatchRooms"],
    queryFn: () => api.get("/watch/my-rooms"),
  });

  const createRoom = useMutation({
    mutationFn: (data: any) => api.post("/watch/rooms", data),
    onSuccess: (room: any) => {
      toast.success("Room created! 🎬");
      setShowCreate(false);
      navigate(`/watch/${room.code}`);
    },
  });

  const joinRoom = useMutation({
    mutationFn: () => api.post(`/watch/join`, { code: joinCode }),
    onSuccess: (room: any) => {
      navigate(`/watch/${room.code}`);
    },
  });

  const deleteRoom = useMutation({
    mutationFn: (id: string) => api.delete(`/watch/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchRooms"] });
      queryClient.invalidateQueries({ queryKey: ["myWatchRooms"] });
      toast.success("Room deleted");
    },
  });

  const allRooms = [...(myRooms || []), ...(rooms || []).filter((r) => !(myRooms || []).some((m) => m.id === r.id))];

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watch Together 🎬</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowJoin(true)}>Join</button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create Room
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Watch videos in sync with friends. Supports YouTube, Vimeo, and other embeddable media.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : allRooms.length === 0 ? (
        <EmptyState
          icon="🎥"
          title="No watch rooms"
          message="Create a room and invite friends to watch together!"
          action={<button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Create Room</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allRooms.map((room) => (
            <motion.div key={room.id} className="card p-5 space-y-3" whileHover={{ y: -2 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white">
                    <Play size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{room.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {room.mediaTitle || "No media yet"} • {room.privacy}
                    </div>
                  </div>
                </div>
                <button
                  className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-50"
                  onClick={() => deleteRoom.mutate(room.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between bg-[var(--surface-2)] rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Users size={14} />
                  <span className="font-semibold text-[var(--text)]">{room.memberCount ?? room.members?.length ?? 0} members</span>
                </div>
                <button
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
                  onClick={() => { navigator.clipboard.writeText(`${room.code}`); toast.success("Code copied!"); }}
                >
                  <Copy size={14} /> {room.code}
                </button>
              </div>
              <button className="btn-primary w-full" onClick={() => navigate(`/watch/${room.code}`)}>
                Join Room
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Watch Room">
        <CreateRoomForm onSubmit={(d) => createRoom.mutate(d)} onClose={() => setShowCreate(false)} isPending={createRoom.isPending} />
      </Modal>

      {/* Join Room Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Room">
        <div className="space-y-4">
          <div>
            <label className="label">Room code</label>
            <input
              className="input uppercase"
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setShowJoin(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => joinRoom.mutate()} disabled={joinCode.length < 4 || joinRoom.isPending}>
              Join
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

function CreateRoomForm({ onSubmit, onClose, isPending }: { onSubmit: (d: any) => void; onClose: () => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [privacy, setPrivacy] = useState("public");

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Room name</label>
        <input className="input" placeholder="Movie night!" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Media URL (YouTube / Vimeo)</label>
        <input className="input" placeholder="https://youtube.com/watch?v=..." value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
        <p className="text-[10px] text-[var(--text-muted)] mt-1">Only legally supported, embeddable sources are allowed.</p>
      </div>
      <div>
        <label className="label">Privacy</label>
        <div className="flex gap-2">
          {["public", "private"].map((p) => (
            <button key={p} className={`btn-secondary capitalize text-sm ${privacy === p ? "ring-2 ring-[var(--accent)]" : ""}`} onClick={() => setPrivacy(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (name.trim()) onSubmit({ name, mediaUrl: mediaUrl || undefined, privacy }); }} disabled={isPending || !name.trim()}>
          Create
        </button>
      </div>
    </div>
  );
}