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
    });

    socket.on("watch:leave", ({ roomId }) => {
      socket.leave(`watch:${roomId}`);
    });

    socket.on("watch:play", ({ roomId, currentTime }) => {
      socket.to(`watch:${roomId}`).emit("watch:play", { userId, currentTime });
    });

    socket.on("watch:pause", ({ roomId, currentTime }) => {
      socket.to(`watch:${roomId}`).emit("watch:pause", { userId, currentTime });
    });

    socket.on("watch:seek", ({ roomId, currentTime }) => {
      socket.to(`watch:${roomId}`).emit("watch:seek", { userId, currentTime });
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

    // ---------- Disconnect ----------
    socket.on("disconnect", async () => {
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