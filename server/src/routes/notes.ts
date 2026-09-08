import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setAt,
  setRow,
  updateAt,
  updateRow,
  removeRow,
  findMany,
  findOne,
  getNested,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { checkTaskAchievements } from "./notifications.js";

const router = Router();
router.use(authMiddleware);

// GET /api/notes
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { archived, search, pinned, type } = req.query;

    let results: any[] = (await findMany("notes", "userId", userId)).map((n) =>
      hydrate("notes", n)
    );

    if (archived === "true") results = results.filter((n) => n.archived);
    else results = results.filter((n) => !n.archived);

    if (pinned === "true") results = results.filter((n) => n.pinned);
    if (type && type !== "all") results = results.filter((n) => n.type === type);

    // Sort by pinned desc, then updatedAt desc (matches SQL)
    results.sort((a: any, b: any) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });

    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      const filtered = results.filter(
        (n) =>
          (n.title ?? "").toLowerCase().includes(q) ||
          (n.contentText ?? "").toLowerCase().includes(q)
      );
      res.json(filtered);
      return;
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /api/notes/shared - notes shared with me
router.get("/shared", async (req: Request, res: Response) => {
  try {
    const shares = await findMany("noteShares", "userId", req.user!.id);

    const sharedNotes = shares
      .map(async (s: any) => {
        const noteSnap = await getAt(`notes/${s.noteId}`);
        if (!noteSnap) return null;
        return { ...hydrate("notes", { id: s.noteId, ...noteSnap }), sharePermission: s.permission, sharedBy: s.sharedBy };
      });

    const results = (await Promise.all(sharedNotes)).filter(Boolean);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shared notes" });
  }
});

// GET /api/notes/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const noteSnap = await getAt(`notes/${req.params.id}`);
    if (!noteSnap) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    const note = hydrate("notes", { id: String(req.params.id), ...noteSnap });

    // Check access
    if (note.userId !== req.user!.id) {
      const share = await findOne(
        "noteShares",
        "noteId",
        String(req.params.id),
      );
      if (!share || share.userId !== req.user!.id) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    const comments = (await getNested(`notes/${note.id}/comments`, { noteId: note.id }))
      .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    res.json({ ...note, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// POST /api/notes
router.post("/", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const now = Date.now();
    const { title, content, type, tags, categoryId } = req.body;

    await setRow("notes", id, {
      userId: req.user!.id,
      title: title || "Untitled note",
      content: content || "",
      contentText: stripHtml(content || ""),
      type: type || "note",
      tags: tags ? JSON.stringify(tags) : "[]",
      categoryId: categoryId || null,
      createdAt: now,
      updatedAt: now,
    });

    const note = await getAt(`notes/${id}`);
    await checkTaskAchievements(req.user!.id);
    res.status(201).json(hydrate("notes", { id, ...note }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// PATCH /api/notes/:id (autosave)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const noteSnap = await getAt(`notes/${id}`);
    if (!noteSnap || noteSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };
    const allowed = [
      "title",
      "content",
      "contentText",
      "type",
      "tags",
      "categoryId",
      "pinned",
      "archived",
      "favorite",
      "shareStatus",
      "studyHours",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "tags") updates[key] = JSON.stringify(req.body[key]);
        else updates[key] = req.body[key];
      }
    }

    // Auto-extract plain text if content updated
    if (req.body.content && !req.body.contentText) {
      updates.contentText = stripHtml(req.body.content);
    }

    await updateRow("notes", id, updates);
    const updatedSnap = await getAt(`notes/${id}`);
    res.json(hydrate("notes", { id, ...updatedSnap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const noteSnap = await getAt(`notes/${String(req.params.id)}`);
    if (!noteSnap || noteSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    // Cascading delete: note node includes comments
    await setAt(`notes/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// POST /api/notes/:id/share
router.post("/:id/share", async (req: Request, res: Response) => {
  try {
    const noteId = String(req.params.id);
    const noteSnap = await getAt(`notes/${noteId}`);
    if (!noteSnap || noteSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const { userId, permission } = req.body;

    if (userId) {
      // Share with specific user
      const shareId = uuid();
      await setRow("noteShares", shareId, {
        noteId,
        sharedBy: req.user!.id,
        userId,
        permission: permission || "view",
        createdAt: Date.now(),
      });

      // Update share status
      await updateRow("notes", noteId, { shareStatus: "shared" });

      res.json({ success: true });
    } else {
      // Generate link
      const shareToken = uuid().slice(0, 12);
      const shareId = uuid();
      await setRow("noteShares", shareId, {
        noteId,
        sharedBy: req.user!.id,
        shareLink: shareToken,
        permission: permission || "view",
        createdAt: Date.now(),
      });

      res.json({ shareLink: shareToken });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to share note" });
  }
});

// DELETE /api/notes/:id/share/:shareId
router.delete("/:id/share/:shareId", async (req: Request, res: Response) => {
  try {
    await removeRow("noteShares", String(req.params.shareId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove share" });
  }
});

// POST /api/notes/:id/comments
router.post("/:id/comments", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { content, mentions } = req.body;

    await setAt(`notes/${req.params.id}/comments/${id}`, {
      userId: req.user!.id,
      content,
      mentions: mentions ? JSON.stringify(mentions) : "[]",
      createdAt: Date.now(),
    });

    res.status(201).json({
      id,
      noteId: String(req.params.id),
      userId: req.user!.id,
      content,
      mentions: mentions ? JSON.stringify(mentions) : "[]",
      createdAt: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// DELETE /api/notes/:id/comments/:commentId
router.delete("/:id/comments/:commentId", async (req: Request, res: Response) => {
  try {
    const noteId = String(req.params.id);
    const commentId = String(req.params.commentId);
    const comment = await getAt(`notes/${noteId}/comments/${commentId}`);
    if (!comment || comment.userId !== req.user!.id) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    await setAt(`notes/${noteId}/comments/${commentId}`, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export default router;