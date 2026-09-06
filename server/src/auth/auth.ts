import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import {
  getAt,
  setRow,
  updateRow,
  findOne,
  defaultProfile,
} from "../db/firebaseClient.js";
import { config } from "../config.js";
import { authMiddleware, AuthUser } from "./middleware.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(100),
  password: z.string().min(6).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateToken(user: AuthUser): string {
  return jwt.sign(user, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  } as any);
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check existing — two queries (no compound OR in Firebase)
    const existingEmail = await findOne("users", "email", body.email);
    const existingUsername = await findOne("users", "username", body.username);
    if (existingEmail) {
      res.status(409).json({ error: "Email already taken" });
      return;
    }
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const id = uuid();
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create user with nested profile
    await setRow("users", id, {
      email: body.email,
      username: body.username,
      displayName: body.displayName,
      passwordHash,
      createdAt: Date.now(),
      profile: defaultProfile(),
    });

    // Create default categories (top-level, user-scoped)
    const defaultCategories = [
      { name: "Personal", color: "#FF8FAB", icon: "🌸", isDefault: true },
      { name: "Study", color: "#A7C7E7", icon: "📚", isDefault: true },
      { name: "Work", color: "#C3FF68", icon: "💼", isDefault: true },
      { name: "Fitness", color: "#FFB7B2", icon: "🏃", isDefault: true },
      { name: "Projects", color: "#FFDAC1", icon: "🚀", isDefault: true },
    ];
    for (let i = 0; i < defaultCategories.length; i++) {
      const cat = defaultCategories[i];
      await setRow("categories", uuid(), {
        userId: id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: true,
        sortOrder: i,
      });
    }

    const tokenPayload: AuthUser = { id, email: body.email, username: body.username };
    const token = generateToken(tokenPayload);

    res.status(201).json({
      user: {
        id,
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        avatar: null,
        bio: "",
        xp: 0,
        level: 1,
        streak: 0,
        longestStreak: 0,
        createdAt: Date.now(),
        online: true,
      },
      token,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await findOne("users", "email", body.email);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({
        error: "Account linked to Google. Please use Google login.",
      });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const tokenPayload: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
    };
    const token = generateToken(tokenPayload);

    // Update online status
    await updateRow("users", user.id, { online: true, lastSeen: Date.now() });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        online: true,
      },
      token,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userSnap = await getAt(`users/${req.user!.id}`);
    if (!userSnap) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // userSnap does NOT include `id` (Firebase key is the ID), inject it explicitly
    const { email, username, displayName, avatar, bio, online, xp, level, streak, longestStreak, createdAt, profile } = userSnap;
    res.json({
      user: {
        id: req.user!.id,
        email,
        username,
        displayName,
        avatar: avatar ?? null,
        bio: bio ?? "",
        online: online ?? false,
        xp: xp ?? 0,
        level: level ?? 1,
        streak: streak ?? 0,
        longestStreak: longestStreak ?? 0,
        createdAt,
        profile: profile ?? defaultProfile(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  try {
    await updateRow("users", req.user!.id, { online: false, lastSeen: Date.now() });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/auth/profile
router.patch("/profile", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { displayName, bio, avatar } = req.body;
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    await updateRow("users", req.user!.id, updates);

    // Return the updated user
    const userSnap = await getAt(`users/${req.user!.id}`);
    res.json({
      id: req.user!.id,
      email: userSnap.email,
      username: userSnap.username,
      displayName: userSnap.displayName,
      avatar: userSnap.avatar ?? null,
      bio: userSnap.bio ?? "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PATCH /api/auth/settings
router.patch("/settings", authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentProfile = (await getAt(`users/${req.user!.id}/profile`)) ?? {};
    await updateRow("users", req.user!.id, {
      profile: { ...currentProfile, ...req.body },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;