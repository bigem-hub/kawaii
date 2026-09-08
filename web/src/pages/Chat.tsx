import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/store/useAuth";
import { Avatar, EmptyState, Skeleton } from "@/components/ui";
import { Send, Plus, Users, Search, MessageSquare, Link2, X } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender?: { id: string; displayName: string; avatar: string | null; username: string };
  type: string;
  createdAt: number;
  reactions: any[];
  studyRoomId?: string;
  studyRoomName?: string;
}

interface Conversation {
  id: string;
  name: string;
  type: string;
  lastMessage?: any;
  unread: number;
  members: any[];
}

export default function Chat() {
  const { id: activeConvId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/chat/conversations"),
  });

  return (
    <div className="flex h-full min-h-0 card overflow-hidden">
      {/* Conversation list */}
      <div className={`${activeConvId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-[var(--border)]`}>
        <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="font-bold px-1 mb-2 flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--accent)]" />
            Messages
          </h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input className="input pl-9 text-sm" placeholder="Search chats..." />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !conversations?.length ? (
            <EmptyState icon={<MessageSquare size={32} className="mx-auto text-[var(--accent)] opacity-30" />} title="No conversations yet" message="Start chatting with friends!" />
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                className={`w-full flex items-center gap-3 p-3 hover:bg-[var(--surface-2)] transition-colors text-left ${
                  activeConvId === conv.id ? "bg-[var(--accent-soft)]" : ""
                }`}
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                <Avatar
                  name={conv.name}
                  avatar={conv.members?.[0]?.user?.avatar}
                  size={44}
                  online={conv.members?.[0]?.user?.online}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{conv.name}</span>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {format(new Date(conv.lastMessage.createdAt), "h:mm a")}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {conv.lastMessage.senderId === user?.id ? "You: " : ""}
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {activeConvId ? (
        <ChatArea convId={activeConvId} />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <EmptyState icon={<MessageSquare size={32} className="mx-auto text-[var(--accent)] opacity-30" />} title="Select a conversation" message="Choose from your chats or start a new one" />
        </div>
      )}
    </div>
  );
}

function ChatArea({ convId }: { convId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["messages", convId],
    queryFn: () => api.get(`/chat/${convId}/messages`),
  });

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoomId, setInviteRoomId] = useState("");
  const [inviteRoomName, setInviteRoomName] = useState("");

  const sendMutation = useMutation({
    mutationFn: (data: { content: string; studyRoomId?: string; studyRoomName?: string }) => 
      api.post(`/chat/${convId}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", convId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      if (data.conversationId === convId) {
        setLocalMessages((prev) => [...prev, data.message]);
        socket.emit("chat:markRead", { conversationId: convId });
      }
    };

    const handleTyping = (data: any) => {
      if (data.conversationId === convId) {
        setIsTyping(data.isTyping ? data.userId : null);
      }
    };

    socket.on("chat:message", handleNewMessage);
    socket.on("chat:typing", handleTyping);

    return () => {
      socket.off("chat:message", handleNewMessage);
      socket.off("chat:typing", handleTyping);
    };
  }, [convId]);

  useEffect(() => {
    if (messages) setLocalMessages([]);
  }, [convId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, messages]);

  const allMessages = [...(messages || []), ...localMessages.filter(
    (lm) => !(messages || []).some((m: any) => m.id === lm.id)
  )];

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ 
      content: message,
      studyRoomId: inviteRoomId || undefined,
      studyRoomName: inviteRoomName || undefined,
    });
    setMessage("");
    setShowInviteModal(false);
    setInviteRoomId("");
    setInviteRoomName("");
  };

  const socket = getSocket();
  const handleTypingStart = () => socket?.emit("chat:typing", { conversationId: convId, isTyping: true });
  const handleTypingStop = () => socket?.emit("chat:typing", { conversationId: convId, isTyping: false });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allMessages.map((msg) => {
          const isMine = msg.senderId === user?.id;
          
          // Render study room invite message
          if (msg.type === "study_invite" && msg.studyRoomId) {
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${isMine ? "order-1" : ""}`}>
                  {!isMine && msg.sender && (
                    <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 px-1">
                      {msg.sender.displayName}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      // Navigate to study page and join room
                      window.location.href = `/study?join=${msg.studyRoomId}`;
                    }}
                    className={`px-4 py-3 rounded-2xl text-sm border border-[var(--border)] flex items-center gap-3 w-full ${isMine ? "bg-[var(--accent-soft)]" : "bg-[var(--surface-2)]"} text-left transition-colors hover:shadow-md`}
                  >
                    <div className="p-2 rounded-xl bg-[var(--accent)] text-white">
                      <MessageSquare size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{msg.studyRoomName || "Study Room Invite"}</div>
                      <div className="text-xs text-[var(--text-muted)]">Room code: {msg.studyRoomId}</div>
                    </div>
                    <Link2 size={18} className="text-[var(--accent)]" />
                  </button>
                  <div className={`text-[10px] text-[var(--text-muted)] mt-0.5 px-1 ${isMine ? "text-right" : ""}`}>
                    {format(new Date(msg.createdAt), "h:mm a")}
                  </div>
                </div>
              </div>
            );
          }
          
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMine ? "order-1" : ""}`}>
                {!isMine && msg.sender && (
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 px-1">
                    {msg.sender.displayName}
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? "bg-[var(--accent)] text-white rounded-br-md"
                      : "bg-[var(--surface-2)] rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`text-[10px] text-[var(--text-muted)] mt-0.5 px-1 ${isMine ? "text-right" : ""}`}>
                  {format(new Date(msg.createdAt), "h:mm a")}
                  {msg.reactions?.length > 0 && (
                    <span className="ml-1">
                      {msg.reactions.map((r: any) => r.emoji).join(" ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="text-xs text-[var(--text-muted)] italic px-2">Typing...</div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTypingStart();
            }}
            onBlur={handleTypingStop}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
                handleTypingStop();
              }
            }}
          />
          <button
            className="btn-secondary !rounded-xl !px-4"
            onClick={() => setShowInviteModal(true)}
            title="Invite to Study Room"
          >
            <MessageSquare size={18} />
          </button>
          <button
            className="btn-primary !rounded-xl !px-4"
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 bg-[var(--bg)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="text-[var(--accent)]" /> Invite to Study Room
              </h2>
              <button className="p-1 text-[var(--text-muted)]" onClick={() => setShowInviteModal(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Room Code</label>
                <input
                  type="text"
                  className="input w-full text-center text-lg tracking-widest font-mono"
                  placeholder="e.g. ABC123XY"
                  value={inviteRoomId}
                  onChange={(e) => setInviteRoomId(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Room Name (optional)</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="My Study Session"
                  value={inviteRoomName}
                  onChange={(e) => setInviteRoomName(e.target.value)}
                />
              </div>
              <p className="text-sm text-[var(--text-muted)]">Enter the study room code you want to invite friends to. They'll be able to join directly from this chat.</p>
              <div className="flex gap-2 pt-2">
                <button className="btn-secondary flex-1" onClick={() => { setShowInviteModal(false); setInviteRoomId(""); setInviteRoomName(""); }}>Cancel</button>
                <button className="btn-primary flex-1" onClick={handleSend} disabled={!inviteRoomId.trim() || sendMutation.isPending}>
                  {sendMutation.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}