import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setRow,
  updateRow,
  removeRow,
  findMany,
  findOne,
  findAll,
  getById,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

async function getFriendUsers(friendIds: string[]): Promise<any[]> {
  const results = await Promise.all(
    friendIds.map((id) => getById("users", id))
  );
  return results
    .filter(Boolean)
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar ?? null,
      online: u.online ?? false,
      lastSeen: u.lastSeen ?? 0,
    }));
}

// GET /api/friends - my friends
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // friendships stored path-based: friendships/{userId}/{friendId}
    const friends = Object.keys((await getAt(`friendships/${userId}`)) ?? {});
    res.json(await getFriendUsers(friends));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

// GET /api/friends/requests
router.get("/requests", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const incoming = (await findMany("friendRequests", "toUserId", userId))
      .filter((r: any) => r.status === "pending")
      .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    // Enrich with sender info
    const enriched = await Promise.all(
      incoming.map(async (req: any) => {
        const user = await getById("users", req.fromUserId);
        return {
          ...req,
          fromUser: user
            ? {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar ?? null,
              }
            : null,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// GET /api/friends/search?q=
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.length < 2) {
      res.json([]);
      return;
    }

    // Two always-pruned queries (no OR in Firebase RTDB), then JS filter.
    const byUsername = await findMany("users", "username", q.toLowerCase());
    const all = await findAll("users");

    const lowerQ = q.toLowerCase();
    const results = all
      .filter((u: any) => u.id !== req.user!.id)
      .filter(
        (u: any) =>
          (u.username ?? "").toLowerCase().includes(lowerQ) ||
          (u.displayName ?? "").toLowerCase().includes(lowerQ)
      )
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar ?? null,
        bio: u.bio ?? "",
        online: u.online ?? false,
      }));

    if (byUsername.length > 0) {
      const byId = new Set(byUsername.map((u: any) => u.id));
      // Ensure exact username matches rank first (order preserved below)
      const exact = byUsername
        .filter((u: any) => u.id !== req.user!.id)
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar ?? null,
          bio: u.bio ?? "",
          online: u.online ?? false,
        }));
      const merged = [...exact, ...results.filter((r: any) => !byId.has(r.id))].slice(0, 20);
      res.json(merged);
      return;
    }

    res.json(results.slice(0, 20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// POST /api/friends/request
router.post("/request", async (req: Request, res: Response) => {
  try {
    const targetUserId = (req.body.toUserId || req.body.userId) as string;
    const fromUserId = req.user!.id;

    if (!targetUserId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    if (targetUserId === fromUserId) {
      res.status(400).json({ error: "Cannot friend yourself" });
      return;
    }

    // Check blocked (both directions) — two queries + JS check
    const blocked = await getAt(`blockedUsers/${fromUserId}/${targetUserId}`);
    const blocked2 = await getAt(`blockedUsers/${targetUserId}/${fromUserId}`);
    if (blocked || blocked2) {
      res.status(403).json({ error: "Cannot send friend request" });
      return;
    }

    // Already friends? (both directions)
    const friend1 = await getAt(`friendships/${fromUserId}/${targetUserId}`);
    const friend2 = await getAt(`friendships/${targetUserId}/${fromUserId}`);
    if (friend1 || friend2) {
      res.status(409).json({ error: "Already friends" });
      return;
    }

    // Pending request in either direction? friendRequests/{id} stores from/to.
    const sentByMe = await findOne(
      "friendRequests",
      "fromUserId",
      fromUserId
    );
    const sentToMe = await findOne("friendRequests", "toUserId", fromUserId);

    // These scans could legitimately return a different counterpart, so check
    // precisely for a pending request between these two users.
    const pendingBetween = (req: any) =>
      req.status === "pending" &&
      ((req.fromUserId === fromUserId && req.toUserId === targetUserId) ||
        (req.fromUserId === targetUserId && req.toUserId === fromUserId));

    const all = [sentByMe, sentToMe].filter(Boolean);
    for (const r of all) {
      if (pendingBetween(r)) {
        res.status(409).json({ error: "Friend request already pending" });
        return;
      }
    }

    // Also handle case where a previously-rejected request exists — allow re-send
    await setRow("friendRequests", uuid(), {
      fromUserId,
      toUserId: targetUserId,
      status: "pending",
      createdAt: Date.now(),
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

// POST /api/friends/accept/:requestId
router.post("/accept/:requestId", async (req: Request, res: Response) => {
  try {
    const requestId = String(req.params.requestId);
    const request = await getById("friendRequests", requestId);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    await updateRow("friendRequests", requestId, { status: "accepted" });

    // Create friendship (both directions) — path-based storage
    await setRow(
      "friendships",
      `${request.toUserId}/${request.fromUserId}`,
      { createdAt: Date.now() }
    );
    await setRow(
      "friendships",
      `${request.fromUserId}/${request.toUserId}`,
      { createdAt: Date.now() }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// POST /api/friends/reject/:requestId
router.post("/reject/:requestId", async (req: Request, res: Response) => {
  try {
    await updateRow("friendRequests", String(req.params.requestId), {
      status: "rejected",
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject request" });
  }
});

// DELETE /api/friends/:friendId
router.delete("/:friendId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = String(req.params.friendId);

    // Remove both directions — path-based
    await removeRow("friendships", `${userId}/${friendId}`);
    await removeRow("friendships", `${friendId}/${userId}`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// POST /api/friends/block
router.post("/block", async (req: Request, res: Response) => {
  try {
    const { blockedId } = req.body;
    await setRow("blockedUsers", `${req.user!.id}/${blockedId}`, {
      createdAt: Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to block user" });
  }
});

// DELETE /api/friends/block/:blockedId
router.delete("/block/:blockedId", async (req: Request, res: Response) => {
  try {
    await removeRow(
      "blockedUsers",
      `${req.user!.id}/${String(req.params.blockedId)}`
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

// ---------- Social links ----------
router.get("/socials", async (req: Request, res: Response) => {
  try {
    const links = (await findMany("socialLinks", "userId", req.user!.id)).map((l) =>
      hydrate("socialLinks", l)
    );
    res.json(links);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/socials", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    await setRow("socialLinks", id, {
      userId: req.user!.id,
      platform: req.body.platform,
      url: req.body.url,
      label: req.body.label || "",
      sortOrder: req.body.sortOrder || 0,
    });
    const link = await getById("socialLinks", id);
    res.status(201).json(hydrate("socialLinks", link));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/socials/:id", async (req: Request, res: Response) => {
  try {
    await removeRow("socialLinks", String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;