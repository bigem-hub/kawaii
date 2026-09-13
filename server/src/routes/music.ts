import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setAt,
  getNested,
  getNestedOne,
  pushRow,
  removeAt,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

/**
 * Personal music data (favorites, playlists, recents) is stored per-user in
 * Firebase RTDB under `/music/{userId}/...`, matching the durable serverless
 * persistence used by study rooms and watch parties.
 *
 * A `track` has the shared shape:
 *   { id, provider: 'youtube'|'spotify', title, artist, thumbnail, url, duration? }
 * Favorites & recents are keyed by `id` (resource id) so re-adding de-dupes.
 */

const FAVS = (uid: string) => `music/${uid}/favorites`;
const PLAYLISTS = (uid: string) => `music/${uid}/playlists`;
const RECENTS = (uid: string) => `music/${uid}/recents`;

// GET /api/music/data - all personal music data in one shot
router.get("/data", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const favorites = await getNested(FAVS(uid));
    const playlists = await getNested(PLAYLISTS(uid));
    const recents = (await getNested(RECENTS(uid))).sort(
      (a, b) => (b.playedAt || 0) - (a.playedAt || 0)
    );
    res.json({ favorites, playlists, recents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load music data" });
  }
});

// POST /api/music/favorites - add (or keep) a favorite track
router.post("/favorites", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const track = { ...req.body };
    delete track.id; // id is the path key
    const id = String(req.body.id || uuid());
    await setAt(`${FAVS(uid)}/${id}`, {
      ...track,
      addedAt: Date.now(),
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save favorite" });
  }
});

// DELETE /api/music/favorites/:id - remove a favorite
router.delete("/favorites/:id", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const id = req.params.id;
    const existing = await getNestedOne(`${FAVS(uid)}/${id}`);
    if (!existing) {
      res.status(404).json({ error: "Favorite not found" });
      return;
    }
    await removeAt(`${FAVS(uid)}/${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// POST /api/music/playlists - create a playlist
router.post("/playlists", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ error: "Playlist name is required" });
      return;
    }
    const id = await pushRow(PLAYLISTS(uid), {
      name,
      items: [],
      createdAt: Date.now(),
    });
    res.json({ playlist: { id, name, items: [], createdAt: Date.now() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

// PATCH /api/music/playlists/:id - rename and/or replace items
router.patch("/playlists/:id", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const id = req.params.id;
    const existing = await getNestedOne(`${PLAYLISTS(uid)}/${id}`);
    if (!existing) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const next: Record<string, unknown> = {};
    if (typeof req.body?.name === "string" && req.body.name.trim()) {
      next.name = req.body.name.trim();
    }
    if (Array.isArray(req.body?.items)) next.items = req.body.items;
    await setAt(`${PLAYLISTS(uid)}/${id}`, { ...existing, ...next, updatedAt: Date.now() });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

// DELETE /api/music/playlists/:id - remove a playlist
router.delete("/playlists/:id", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const id = req.params.id;
    const existing = await getNestedOne(`${PLAYLISTS(uid)}/${id}`);
    if (!existing) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    await removeAt(`${PLAYLISTS(uid)}/${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// POST /api/music/recents - record a recent play (deduped, capped at 20)
router.post("/recents", async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const track = { ...req.body };
    delete track.id;
    const id = String(req.body?.id || uuid());
    await setAt(`${RECENTS(uid)}/${id}`, {
      ...track,
      playedAt: Date.now(),
    });
    // Trim to the 20 most recent
    const recent = (await getNested(RECENTS(uid))).sort(
      (a, b) => (b.playedAt || 0) - (a.playedAt || 0)
    );
    const toTrim = recent.slice(20);
    for (const r of toTrim) {
      await removeAt(`${RECENTS(uid)}/${r.id}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record recent" });
  }
});

export default router;