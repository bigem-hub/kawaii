import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config.js";
import {
  updateRow,
  findMany,
  findOne,
  getAt,
  pushRow,
} from "../db/firebaseClient.js";

let io: Server | null = null;
const activeWatchers = new Map<string, Set<string>>();
const activeStudyMembers = new Map<string, Set<string>>();

function broadcastStudyCount(roomId: string) {
  io?.to(`study:${roomId}`).emit("study:presence", {
    count: activeStudyMembers.get(roomId)?.size ?? 0,
  });
}

function broadcastWatcherCount(roomId: string) {
  io?.to(`watch:${roomId}`).emit("watch:presence", {
    count: activeWatchers.get(roomId)?.size ?? 0,
  });
}

export function initRealtime(server: any) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, config.jwt.secret) as { id: string };
      (socket as any).userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = (socket as any).userId as string;

    // Presence
    await updateRow("users", userId, { online: true, lastSeen: Date.now() });
    socket.join(`user:${userId}`);
    socket.broadcast.emit("presence", { userId, online: true });

    // Join all conversations the user is a member of
    const memberships = await findMany("conversationMembers", "userId", userId);
    memberships.forEach((m: any) => socket.join(`conv:${m.conversationId}`));

    // ---------- Chat events ----------
    socket.on("chat:typing", ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit("chat:typing", {
        userId,
        conversationId,
        isTyping,
      });
    });

    socket.on("chat:markRead", async ({ conversationId }) => {
      try {
        // Composite key is deterministic: conversationId_userId
        await updateRow("conversationMembers", `${conversationId}_${userId}`, {
          lastReadAt: Date.now(),
        });
      } catch (err) {
        console.error("chat:markRead error:", err);
      }
    });

    // ---------- Watch party events ----------
    socket.on("watch:join", ({ roomId }) => {
      socket.join(`watch:${roomId}`);
      const watchers = activeWatchers.get(roomId) ?? new Set<string>();
      watchers.add(userId);
      activeWatchers.set(roomId, watchers);
      broadcastWatcherCount(roomId);
    });

    socket.on("watch:leave", ({ roomId }) => {
      socket.leave(`watch:${roomId}`);
      const watchers = activeWatchers.get(roomId);
      watchers?.delete(userId);
      if (watchers?.size === 0) activeWatchers.delete(roomId);
      broadcastWatcherCount(roomId);
    });

    socket.on("watch:play", async ({ roomId, currentTime }) => {
      const room = await getAt(`watchRooms/${roomId}`);
      if (!room || room.hostId !== userId) return;
      socket.to(`watch:${roomId}`).emit("watch:play", { currentTime });
    });

    socket.on("watch:pause", async ({ roomId, currentTime }) => {
      const room = await getAt(`watchRooms/${roomId}`);
      if (!room || room.hostId !== userId) return;
      socket.to(`watch:${roomId}`).emit("watch:pause", { currentTime });
    });

    socket.on("watch:seek", async ({ roomId, currentTime }) => {
      const room = await getAt(`watchRooms/${roomId}`);
      if (!room || room.hostId !== userId) return;
      socket.to(`watch:${roomId}`).emit("watch:seek", { currentTime });
    });

    socket.on("watch:chat", async ({ roomId, content }) => {
      const id = uuid();
      await pushRow("watchMessages", {
        roomId,
        userId,
        content,
        createdAt: Date.now(),
      });
      const userSnap = await getAt(`users/${userId}`);
      const user = userSnap
        ? { displayName: userSnap.displayName, avatar: userSnap.avatar }
        : null;
      io?.to(`watch:${roomId}`).emit("watch:chat", {
        id,
        content,
        userId,
        user,
        createdAt: Date.now(),
      });
    });

    // ---------- Study Room events ----------
    socket.on("study:join", async ({ roomId }) => {
      socket.join(`study:${roomId}`);
      const members = activeStudyMembers.get(roomId) ?? new Set<string>();
      members.add(userId);
      activeStudyMembers.set(roomId, members);
      
      // Notify others in the room about the new participant
      const userSnap = await getAt(`users/${userId}`);
      const participantName = userSnap?.displayName || userSnap?.username || "Someone";
      const participantColor = ["#ff8fab", "#a78bfa", "#7dd3c7", "#fbbf77", "#60a5fa", "#3d3a3f"][members.size % 6];
      
      socket.to(`study:${roomId}`).emit("study:participant-joined", {
        participantId: userId,
        participantName,
        participantColor,
      });
      
      broadcastStudyCount(roomId);
    });

    socket.on("study:leave", async ({ roomId }) => {
      socket.leave(`study:${roomId}`);
      const members = activeStudyMembers.get(roomId);
      members?.delete(userId);
      if (members?.size === 0) activeStudyMembers.delete(roomId);
      
      socket.to(`study:${roomId}`).emit("study:participant-left", {
        participantId: userId,
      });
      
      broadcastStudyCount(roomId);
    });

    socket.on("study:draw", ({ roomId, drawData }) => {
      socket.to(`study:${roomId}`).emit("study:draw", drawData);
    });

    socket.on("study:clear", ({ roomId }) => {
      socket.to(`study:${roomId}`).emit("study:clear");
    });

    // WebRTC signaling
    socket.on("study:offer", ({ roomId, targetId, offer }) => {
      socket.to(`user:${targetId}`).emit("study:offer", {
        fromId: userId,
        offer,
      });
    });

    socket.on("study:answer", ({ roomId, targetId, answer }) => {
      socket.to(`user:${targetId}`).emit("study:answer", {
        fromId: userId,
        answer,
      });
    });

    socket.on("study:ice-candidate", ({ roomId, targetId, candidate }) => {
      socket.to(`user:${targetId}`).emit("study:ice-candidate", {
        fromId: userId,
        candidate,
      });
    });

    // Study room chat
    socket.on("study:chat", async ({ roomId, message }) => {
      const userSnap = await getAt(`users/${userId}`);
      const from = userSnap?.displayName || userSnap?.username || "Someone";
      io?.to(`study:${roomId}`).emit("study:chat", { from, message });
    });

    // Hand raise
    socket.on("study:hand", ({ roomId, raised }) => {
      socket.to(`study:${roomId}`).emit("study:hand-raised", {
        participantId: userId,
        raised,
      });
    });

    // Mute/unmute
    socket.on("study:mute", ({ roomId, muted }) => {
      socket.to(`study:${roomId}`).emit("study:mute-changed", {
        participantId: userId,
        muted,
      });
    });

    // ---------- Disconnect ----------
    socket.on("disconnect", async () => {
      for (const room of socket.rooms) {
        if (room.startsWith("watch:")) {
          const roomId = room.slice("watch:".length);
          const watchers = activeWatchers.get(roomId);
          watchers?.delete(userId);
          if (watchers?.size === 0) activeWatchers.delete(roomId);
          broadcastWatcherCount(roomId);
        } else if (room.startsWith("study:")) {
          const roomId = room.slice("study:".length);
          const members = activeStudyMembers.get(roomId);
          members?.delete(userId);
          if (members?.size === 0) activeStudyMembers.delete(roomId);
          broadcastStudyCount(roomId);
        }
      }
      await updateRow("users", userId, {
        online: false,
        lastSeen: Date.now(),
      });
      socket.broadcast.emit("presence", { userId, online: false });
    });
  });

  console.log("✅ Realtime (Socket.IO) initialized");
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Realtime not initialized");
  return io;
}