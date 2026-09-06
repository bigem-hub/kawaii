import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setAt,
  setRow,
  updateRow,
  findMany,
  findOne,
  getById,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { getIO } from "../realtime/index.js";

const router = Router();
router.use(authMiddleware);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Resolve a room from a URL param that may be either the room UUID or the
 * 6-char join code. The web frontend navigates to `/watch/{code}` and calls
 * `/watch/rooms/{code}`, while the Android app passes the room UUID. Returns
 * `{ id, room }` (id is always the UUID) or null.
 */
async function resolveRoom(param: string): Promise<{ id: string; room: any } | null> {
  // If it looks like the short join code, query by the `code` field first.
  if (/^[A-Z2-9]{6}$/.test(param) || param.length <= 8) {
    const byCode = await findOne("watchRooms", "code", param);
    if (byCode) return { id: byCode.id, room: byCode };
  }
  // Fall back to direct UUID path lookup.
  const direct = await getById("watchRooms", param);
  if (direct) return { id: param, room: direct };
  return null;
}

// GET /api/watch/rooms — list public active rooms
router.get("/rooms", async (req: Request, res: Response) => {
  try {
    const all = await findMany("watchRooms", "active", true);
    res.json(
      all
        .map((r) => ({
          ...r,
          active: r.active ?? true,
          privacy: r.privacy ?? "private",
        }))
        .filter((r) => r.privacy === "public")
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/watch/my-rooms — rooms I'm a member of
router.get("/my-rooms", async (req: Request, res: Response) => {
  try {
    const memberships = await findMany(
      "watchRoomMembers",
      "userId",
      req.user!.id
    );
    const rooms = (
      await Promise.all(
        memberships.map(async (m: any) => {
          const roomSnap = await getAt(`watchRooms/${m.roomId}`);
          return roomSnap ? { id: m.roomId, ...roomSnap } : null;
        })
      )
    ).filter(Boolean);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/watch/rooms — create room
router.post("/rooms", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const code = generateCode();
    const { name, mediaUrl, privacy } = req.body;

    const parsed = parseMediaUrl(mediaUrl);

    await setRow("watchRooms", id, {
      code,
      hostId: req.user!.id,
      name: name || "Watch Party",
      mediaUrl: mediaUrl || "",
      mediaProvider: parsed?.provider || "",
      mediaId: parsed?.id || "",
      privacy: privacy || "private",
      isPlaying: false,
      currentTime: 0,
      active: true,
      createdAt: Date.now(),
    });

    await setRow(
      "watchRoomMembers",
      `${id}_${req.user!.id}`,
      { roomId: id, userId: req.user!.id, role: "host", joinedAt: Date.now() }
    );

    const room = await getById("watchRooms", id);
    res.status(201).json({ ...room, code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// POST /api/watch/join — join by code
router.post("/join", async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const room = await findOne("watchRooms", "code", code);
    if (!room || !room.active) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const existing = await getAt(
      `watchRoomMembers/${room.id}_${req.user!.id}`
    );
    if (!existing) {
      await setRow(
        "watchRoomMembers",
        `${room.id}_${req.user!.id}`,
        { roomId: room.id, userId: req.user!.id, role: "member", joinedAt: Date.now() }
      );
    }

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// GET /api/watch/rooms/:id  (id may be a UUID or the 6-char join code)
router.get("/rooms/:id", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const { id: roomId, room: roomSnap } = resolved;
    const room = { id: roomId, ...roomSnap };

    const memberships = await findMany("watchRoomMembers", "roomId", roomId);
    const enrichedMembers = await Promise.all(
      memberships.map(async (m: any) => {
        const user = await getById("users", m.userId);
        return {
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: user
            ? {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar ?? null,
                online: user.online ?? false,
              }
            : null,
        };
      })
    );

    const messages = await findMany("watchMessages", "roomId", roomId);

    res.json({ ...room, members: enrichedMembers, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/watch/rooms/:id/media
router.patch("/rooms/:id/media", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) { res.status(404).json({ error: "Room not found" }); return; }
    const { id: roomId } = resolved;
    const { mediaUrl, isPlaying, currentTime } = req.body;
    const parsed = parseMediaUrl(mediaUrl);

    // Support both media-update and playback-control payloads.
    const update: Record<string, any> = {};
    if (mediaUrl !== undefined) {
      Object.assign(update, {
        mediaUrl,
        mediaProvider: parsed?.provider || "",
        mediaId: parsed?.id || "",
        currentTime: 0,
        isPlaying: false,
      });
    }
    if (isPlaying !== undefined) update.isPlaying = isPlaying;
    if (currentTime !== undefined) update.currentTime = currentTime;

    await updateRow("watchRooms", roomId, update);

    const room = await getById("watchRooms", roomId);
    if (room) {
      getIO().to(`watch:${roomId}`).emit("media:update", {
        mediaUrl: room.mediaUrl,
        mediaProvider: room.mediaProvider,
        mediaId: room.mediaId,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
      });
    }
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/watch/rooms/:id — soft-close
router.delete("/rooms/:id", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) { res.status(404).json({ error: "Room not found" }); return; }
    const { id: roomId } = resolved;
    await updateRow("watchRooms", roomId, { active: false });
    getIO().to(`watch:${roomId}`).emit("room:closed");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/watch/rooms/:id/leave
router.post("/rooms/:id/leave", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) { res.status(404).json({ error: "Room not found" }); return; }
    const { id: roomId } = resolved;
    await setAt(`watchRoomMembers/${roomId}_${req.user!.id}`, null);
    getIO()
      .to(`watch:${roomId}`)
      .emit("member:left", { userId: req.user!.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/watch/rooms/:id/join — join by id/code (for Android)
router.post("/rooms/:id/join", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved || !resolved.room.active) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const { id: roomId } = resolved;

    const existing = await getAt(`watchRoomMembers/${roomId}_${req.user!.id}`);
    if (existing) {
      res.status(409).json({ error: "Already a member of this room" });
      return;
    }

    await setRow("watchRoomMembers", `${roomId}_${req.user!.id}`, {
      roomId,
      userId: req.user!.id,
      role: "member",
      joinedAt: Date.now(),
    });
    res.json(resolved.room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// POST /api/watch/rooms/:id/messages
router.post("/rooms/:id/messages", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) { res.status(404).json({ error: "Room not found" }); return; }
    const { id: roomId } = resolved;
    const msgId = uuid();
    await setRow("watchMessages", msgId, {
      roomId,
      userId: req.user!.id,
      content: req.body.content,
      createdAt: Date.now(),
    });
    const msg = await getById("watchMessages", msgId);
    getIO().to(`watch:${roomId}`).emit("chat:message", msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/watch/rooms/:id/messages — message list for a room
router.get("/rooms/:id/messages", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveRoom(String(req.params.id));
    if (!resolved) { res.status(404).json({ error: "Room not found" }); return; }
    const { id: roomId } = resolved;
    const messages = await findMany("watchMessages", "roomId", roomId);
    // Enrich with sender info
    const enriched = await Promise.all(
      messages.map(async (m: any) => {
        const user = await getById("users", m.userId);
        return {
          ...m,
          sender: user
            ? { displayName: user.displayName, avatar: user.avatar ?? null }
            : null,
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

function parseMediaUrl(url: string): { provider: string; id: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id =
        u.searchParams.get("v") ||
        (u.pathname.length > 1 ? u.pathname.slice(1) : "");
      return { provider: "youtube", id };
    }
    if (u.hostname.includes("vimeo.com")) {
      return { provider: "vimeo", id: u.pathname.split("/").pop() || "" };
    }
    return { provider: "custom", id: url };
  } catch {
    return { provider: "custom", id: url };
  }
}

export default router;