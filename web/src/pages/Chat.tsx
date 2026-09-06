import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/store/useAuth";
import { Avatar, EmptyState, Skeleton } from "@/components/ui";
import { Send, Plus, Users, Search } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender?: { id: string; displayName: string; avatar: string | null; username: string };
  type: string;
  createdAt: number;
  reactions: any[];
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
    <div className="flex h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] card overflow-hidden">
      {/* Conversation list */}
      <div className={`${activeConvId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-[var(--border)]`}>
        <div className="p-3 border-b border-[var(--border)]">
          <h2 className="font-bold px-1 mb-2">Messages 💬</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input className="input pl-9 text-sm" placeholder="Search chats..." />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !conversations?.length ? (
            <EmptyState icon="💬" title="No conversations yet" message="Start chatting with friends!" />
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
          <EmptyState icon="💌" title="Select a conversation" message="Choose from your chats or start a new one" />
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

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.post(`/chat/${convId}/messages`, { content }),
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
    sendMutation.mutate(message);
    setMessage("");
  };

  const socket = getSocket();
  const handleTypingStart = () => socket?.emit("chat:typing", { conversationId: convId, isTyping: true });
  const handleTypingStop = () => socket?.emit("chat:typing", { conversationId: convId, isTyping: false });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allMessages.map((msg) => {
          const isMine = msg.senderId === user?.id;
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
            className="btn-primary !rounded-xl !px-4"
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}