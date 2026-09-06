import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { getSocket } from "@/lib/socket";
import { Avatar, Skeleton } from "@/components/ui";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Send, Users, Settings, LogOut, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface Room {
  id: string;
  code: string;
  name: string;
  mediaUrl?: string;
  mediaTitle?: string;
  mediaProvider?: string;
  mediaId?: string;
  isPlaying: boolean;
  currentTime: number;
  hostId: string;
  privacy: string;
  members: any[];
}

interface RoomMessage {
  id: string;
  content: string;
  sender?: { displayName: string; avatar: string | null };
  createdAt: number;
}

export default function WatchRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);

  const { data: room, isLoading } = useQuery<Room>({
    queryKey: ["watchRoom", code],
    queryFn: () => api.get(`/watch/rooms/${code}`),
    refetchInterval: 5000,
  });

  const { data: messages } = useQuery<RoomMessage[]>({
    queryKey: ["watchMessages", code],
    queryFn: () => api.get(`/watch/rooms/${code}/messages`),
    refetchInterval: 2000,
  });

  // Socket for realtime sync
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !room) return;

    socket.emit("watch:join", { roomId: room.id });

    const handlePlay = (data: any) => {
      setIsPlaying(true);
      setCurrentTime(data.currentTime);
    };
    const handlePause = (data: any) => {
      setIsPlaying(false);
      setCurrentTime(data.currentTime);
    };
    const handleSeek = (data: any) => {
      setCurrentTime(data.currentTime);
    };
    const handleMediaChange = () => {
      queryClient.invalidateQueries({ queryKey: ["watchRoom", code] });
    };

    socket.on("watch:play", handlePlay);
    socket.on("watch:pause", handlePause);
    socket.on("watch:seek", handleSeek);
    socket.on("watch:mediaChange", handleMediaChange);
    socket.on("watch:chat", () => {
      queryClient.invalidateQueries({ queryKey: ["watchMessages", code] });
    });

    return () => {
      socket.emit("watch:leave", { roomId: room.id });
      socket.off("watch:play", handlePlay);
      socket.off("watch:pause", handlePause);
      socket.off("watch:seek", handleSeek);
      socket.off("watch:mediaChange", handleMediaChange);
    };
  }, [room?.id, code]);

  const playMutation = useMutation({
    mutationFn: (time: number) => {
      const socket = getSocket();
      socket?.emit("watch:play", { roomId: room?.id, currentTime: time });
      return api.patch(`/watch/rooms/${room?.id}/media`, { isPlaying: true, currentTime: time });
    },
    onSuccess: () => setIsPlaying(true),
  });

  const pauseMutation = useMutation({
    mutationFn: (time: number) => {
      const socket = getSocket();
      socket?.emit("watch:pause", { roomId: room?.id, currentTime: time });
      return api.patch(`/watch/rooms/${room?.id}/media`, { isPlaying: false, currentTime: time });
    },
    onSuccess: () => setIsPlaying(false),
  });

  const sendChat = useMutation({
    mutationFn: (content: string) => api.post(`/watch/rooms/${code}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchMessages", code] });
      setChatMessage("");
    },
  });

  const updateMedia = useMutation({
    mutationFn: (url: string) => api.patch(`/watch/rooms/${room?.id}/media`, { mediaUrl: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchRoom", code] });
      setShowMediaInput(false);
      setNewMediaUrl("");
      toast.success("Media updated!");
    },
  });

  const isHost = room?.hostId === user?.id;

  const renderEmbed = () => {
    if (!room?.mediaUrl) {
      return (
        <div className="aspect-video bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center text-[var(--text-muted)]">
          <div className="text-center space-y-3">
            <div className="text-5xl">🎬</div>
            <p>No media loaded</p>
            {isHost && (
              <button className="btn-primary text-sm" onClick={() => setShowMediaInput(true)}>
                Add a video
              </button>
            )}
          </div>
        </div>
      );
    }

    // YouTube embed
    if (room.mediaProvider === "youtube") {
      return (
        <iframe
          className="w-full aspect-video rounded-xl"
          src={`https://www.youtube.com/embed/${room.mediaId}?enablejsapi=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={room.mediaTitle || "YouTube video"}
        />
      );
    }

    // Vimeo embed
    if (room.mediaProvider === "vimeo") {
      return (
        <iframe
          className="w-full aspect-video rounded-xl"
          src={`https://player.vimeo.com/video/${room.mediaId}?api=1`}
          allow="autoplay; fullscreen"
          allowFullScreen
          title={room.mediaTitle || "Vimeo video"}
        />
      );
    }

    // Generic video
    return (
      <video
        className="w-full aspect-video rounded-xl bg-black"
        controls
        src={room.mediaUrl}
      />
    );
  };

  if (isLoading) {
    return <Skeleton className="h-[60vh]" />;
  }

  if (!room) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold mb-2">Room not found</h2>
        <button className="btn-primary" onClick={() => navigate("/watch")}>
          Back to Watch Together
        </button>
      </div>
    );
  }

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => navigate("/watch")}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="badge bg-[var(--surface-2)]">{room.code}</span>
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Users size={14} /> {room.members?.length || 0} watching
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <div className="card overflow-hidden">
            {renderEmbed()}
            {/* Controls for host */}
            {isHost && room.mediaUrl && (
              <div className="p-3 flex items-center gap-3">
                <button
                  className="btn-primary !rounded-full !p-2"
                  onClick={() => isPlaying ? pauseMutation.mutate(currentTime) : playMutation.mutate(currentTime)}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setShowMediaInput(true)}>
                  <Settings size={14} /> Change Media
                </button>
                <div className="text-xs text-[var(--text-muted)] ml-auto">
                  {isPlaying ? "▶ Playing" : "⏸ Paused"}
                </div>
              </div>
            )}
          </div>

          {/* Room info */}
          <div className="card p-4">
            <h2 className="font-bold">{room.name}</h2>
            {room.mediaTitle && (
              <p className="text-sm text-[var(--text-muted)] mt-1">Now playing: {room.mediaTitle}</p>
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="card flex flex-col h-[60vh]">
          <div className="p-3 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm flex items-center gap-2"><MessageCircle size={16} /> Room Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages?.map((msg, i) => (
              <div key={msg.id || i} className="flex items-start gap-2">
                <Avatar name={msg.sender?.displayName || "?"} avatar={msg.sender?.avatar} size={28} />
                <div>
                  <div className="text-xs font-semibold">{msg.sender?.displayName}</div>
                  <div className="text-sm bg-[var(--surface-2)] rounded-xl px-3 py-1.5 mt-0.5">{msg.content}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Say something..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatMessage.trim()) {
                    sendChat.mutate(chatMessage);
                    setChatMessage("");
                  }
                }}
              />
              <button
                className="btn-primary !px-3 !rounded-xl"
                onClick={() => { if (chatMessage.trim()) sendChat.mutate(chatMessage); }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Media Modal */}
      {showMediaInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMediaInput(false)}>
          <div className="card p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Change Media</h3>
            <input
              className="input"
              placeholder="YouTube / Vimeo URL"
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              autoFocus
            />
            <p className="text-[10px] text-[var(--text-muted)]">Only embeddable, legally supported media is allowed.</p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowMediaInput(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => updateMedia.mutate(newMediaUrl)} disabled={!newMediaUrl.trim()}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}