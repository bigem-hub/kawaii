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
  getNested,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { getIO } from "../realtime/index.js";

const router = Router();
router.use(authMiddleware);

async function enrichConversation(conv: any, userId: string) {
  // Members stored at top level with composite key {conversationId}_{userId}
  const members = await findMany(
    "conversationMembers",
    "conversationId",
    conv.id
  );

  const memberUsers = await Promise.all(
    members.map(async (m: any) => {
      const user = await getById("users", m.userId);
      return {
        ...m,
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

  // Last message
  const msgs = (
    await findMany("messages", "conversationId", conv.id)
  ).sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const lastMessage = msgs[0] ?? null;

  // Unread count
  const myMember = members.find((m: any) => m.userId === userId);
  const unread = lastMessage
    ? msgs.filter(
        (m: any) =>
          m.senderId !== userId && m.createdAt > (myMember?.lastReadAt ?? 0)
      ).length
    : 0;

  // Name resolution for direct chats
  let name = conv.name;
  if (conv.type === "direct") {
    const other = memberUsers.find((m: any) => m.userId !== userId);
    name = other?.user?.displayName || other?.user?.username || "Chat";
  }

  return { ...conv, name, members: memberUsers, lastMessage, unread };
}

// GET /api/chat/conversations
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memberships = await findMany(
      "conversationMembers",
      "userId",
      userId
    );

    const convs = (
      await Promise.all(
        memberships.map(async (m: any) => {
          const c = await getAt(`conversations/${m.conversationId}`);
          return c ? { id: m.conversationId, ...c } : null;
        })
      )
    ).filter(Boolean);

    const enriched = await Promise.all(
      convs.map(async (c) => enrichConversation(c!, userId))
    );
    enriched.sort(
      (a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0)
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// POST /api/chat/direct - create or get direct conversation with a user
router.post("/direct", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.body.friendId || req.body.userId;

    // Find existing direct conversation between the two
    const myConvs = await findMany("conversationMembers", "userId", userId);

    for (const m of myConvs) {
      const convSnap = await getAt(`conversations/${m.conversationId}`);
      if (!convSnap || convSnap.type !== "direct") continue;

      const other = await findOne(
        "conversationMembers",
        "conversationId",
        m.conversationId
      );
      if (other && other.userId === friendId) {
        res.json(
          await enrichConversation(
            { id: m.conversationId, ...convSnap },
            userId
          )
        );
        return;
      }
    }

    // Create new conversation
    const convId = uuid();
    await setRow("conversations", convId, {
      type: "direct",
      createdBy: userId,
      createdAt: Date.now(),
    });
    await setRow(
      "conversationMembers",
      `${convId}_${userId}`,
      { conversationId: convId, userId, role: "owner", joinedAt: Date.now() }
    );
    await setRow(
      "conversationMembers",
      `${convId}_${friendId}`,
      { conversationId: convId, userId: friendId, role: "member", joinedAt: Date.now() }
    );

    const convSnap = await getAt(`conversations/${convId}`);
    res
      .status(201)
      .json(await enrichConversation({ id: convId, ...convSnap }, userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// POST /api/chat/group - create group
router.post("/group", async (req: Request, res: Response) => {
  try {
    const { name, memberIds } = req.body;
    const convId = uuid();
    await setRow("conversations", convId, {
      type: "group",
      name,
      createdBy: req.user!.id,
      createdAt: Date.now(),
    });
    await setRow(
      "conversationMembers",
      `${convId}_${req.user!.id}`,
      { conversationId: convId, userId: req.user!.id, role: "owner", joinedAt: Date.now() }
    );
    for (const id of memberIds || []) {
      await setRow(
        "conversationMembers",
        `${convId}_${id}`,
        { conversationId: convId, userId: id, role: "member", joinedAt: Date.now() }
      );
    }

    const convSnap = await getAt(`conversations/${convId}`);
    res
      .status(201)
      .json(await enrichConversation({ id: convId, ...convSnap }, req.user!.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// GET /api/chat/:convId/messages
router.get("/:convId/messages", async (req: Request, res: Response) => {
  try {
    const convId = String(req.params.convId);
    const userId = req.user!.id;

    // Verify membership
    const memberSnap = await getAt(
      `conversationMembers/${convId}_${userId}`
    );
    if (!memberSnap) {
      res.status(403).json({ error: "Not a member" });
      return;
    }

    const msgs = (
      await findMany("messages", "conversationId", convId)
    )
      .sort((a: any, b: any) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .slice(-100);

    // Enrich senders + reactions
    const enriched = await Promise.all(
      msgs.map(async (m: any) => {
        const sender = await getById("users", m.senderId);
        const reactions = await getNested(`messages/${m.id}/reactions`, { messageId: m.id });
        return {
          ...hydrate("messages", m),
          sender: sender
            ? {
                id: sender.id,
                username: sender.username,
                displayName: sender.displayName,
                avatar: sender.avatar ?? null,
              }
            : null,
          reactions,
        };
      })
    );

    // Update last read
    await updateRow(
      "conversationMembers",
      `${convId}_${userId}`,
      { lastReadAt: Date.now() }
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/chat/:convId/messages - send message
router.post("/:convId/messages", async (req: Request, res: Response) => {
  try {
    const convId = String(req.params.convId);
    const userId = req.user!.id;
    const { content, type, replyTo, fileUrl, fileName, fileType, studyRoomId, studyRoomName } = req.body;

    // Verify membership
    const memberSnap = await getAt(
      `conversationMembers/${convId}_${userId}`
    );
    if (!memberSnap) {
      res.status(403).json({ error: "Not a member" });
      return;
    }

    const id = uuid();
    const now = Date.now();
    const messageType = type || (studyRoomId ? "study_invite" : "text");
    
    await setRow("messages", id, {
      conversationId: convId,
      senderId: userId,
      type: messageType,
      content: content || "",
      replyTo: replyTo || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      studyRoomId: studyRoomId || null,
      studyRoomName: studyRoomName || null,
      createdAt: now,
      updatedAt: now,
    });

    const msg = hydrate("messages", { id, conversationId: convId, senderId: userId, type: messageType, content: content || "", replyTo: replyTo || null, fileUrl: fileUrl || null, fileName: fileName || null, fileType: fileType || null, studyRoomId: studyRoomId || null, studyRoomName: studyRoomName || null, createdAt: now, updatedAt: now });
    const sender = await getById("users", userId);

    const payload = {
      ...msg,
      sender: sender
        ? {
            id: sender.id,
            username: sender.username,
            displayName: sender.displayName,
            avatar: sender.avatar ?? null,
          }
        : null,
      reactions: [],
    };

    // Emit to all members in the room
    const members = await findMany(
      "conversationMembers",
      "conversationId",
      convId
    );
    members.forEach((m: any) => {
      getIO()
        .to(`user:${m.userId}`)
        .emit("chat:message", { conversationId: convId, message: payload });
    });

    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// PATCH /api/chat/messages/:id - edit
router.patch("/messages/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await updateRow("messages", id, {
      content: req.body.content,
      edited: true,
      updatedAt: Date.now(),
    });
    const msg = await getById("messages", id);
    res.json(hydrate("messages", msg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/chat/messages/:id
router.delete("/messages/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const msg = await getById("messages", id);
    if (!msg) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (msg.senderId !== req.user!.id) {
      res.status(403).json({ error: "Cannot delete others' messages" });
      return;
    }
    await updateRow("messages", id, {
      content: "🚫 Message deleted",
      type: "system",
      fileUrl: null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/chat/messages/:id/react
router.post("/messages/:id/react", async (req: Request, res: Response) => {
  try {
    const { emoji } = req.body;
    const msg = await getById("messages", String(req.params.id));
    if (!msg) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Scan nested reactions for one by this user with same emoji
    const allReactions = await getNested(`messages/${msg.id}/reactions`, {
      messageId: msg.id,
    });
    const existing = allReactions.find(
      (r: any) => r.userId === req.user!.id && r.emoji === emoji
    );

    if (existing) {
      // Toggle off
      await setAt(`messages/${msg.id}/reactions/${existing.id}`, null);
    } else {
      const reactionId = uuid();
      await setAt(`messages/${msg.id}/reactions/${reactionId}`, {
        userId: req.user!.id,
        emoji,
        createdAt: Date.now(),
      });
    }

    const reactions = await getNested(`messages/${msg.id}/reactions`, {
      messageId: msg.id,
    });
    getIO()
      .to(`user:${msg.senderId}`)
      .emit("chat:reaction", { messageId: msg.id, reactions });
    res.json({ messageId: msg.id, reactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;