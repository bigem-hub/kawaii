import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  setRow,
  getAt,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

// POST /api/study/create-room - Create a new study room
router.post("/create-room", async (req: Request, res: Response) => {
  try {
    const roomId = uuid().slice(0, 8).toUpperCase();
    const now = Date.now();
    
    await setRow("studyRooms", roomId, {
      hostId: req.user!.id,
      createdAt: now,
      isActive: true,
    });

    res.json({ roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create study room" });
  }
});

// GET /api/study/rooms - List active study rooms
router.get("/rooms", async (req: Request, res: Response) => {
  try {
    // For now return empty, can be extended
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch study rooms" });
  }
});

// GET /api/study/room/:roomId - Get room details
router.get("/room/:roomId", async (req: Request, res: Response) => {
  try {
    const roomSnap = await getAt(`studyRooms/${req.params.roomId}`);
    if (!roomSnap) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ roomId: req.params.roomId, ...roomSnap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

export default router;