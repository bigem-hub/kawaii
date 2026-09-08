import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  setRow,
  updateRow,
  removeRow,
  findMany,
  hydrate,
  getAt,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/finance/transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let results = (await findMany("finance_transactions", "userId", userId)).map((t) =>
      hydrate("finance_transactions", t)
    );

    // Sort by date descending
    results.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA || (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/finance/summary
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const transactions = (await findMany("finance_transactions", "userId", userId)).map((t) =>
      hydrate("finance_transactions", t)
    );

    let balance = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let monthIncome = 0;
    let monthExpense = 0;

    for (const t of transactions) {
      if (t.type === "income") {
        balance += t.amount;
        totalIncome += t.amount;
      } else {
        balance -= t.amount;
        totalExpense += t.amount;
      }

      const tDate = new Date(t.date);
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.type === "income") monthIncome += t.amount;
        else monthExpense += t.amount;
      }
    }

    res.json({
      balance,
      totalIncome,
      totalExpense,
      monthIncome,
      monthExpense,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// POST /api/finance/transactions
router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const now = Date.now();
    const { amount, title, description, category, type, date, notes } = req.body;

    if (!title?.trim() || amount === undefined || !type || !date) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await setRow("finance_transactions", id, {
      userId: req.user!.id,
      amount: Number(amount),
      title: title.trim(),
      description: description || "",
      category: category || "other",
      type,
      date,
      notes: notes || "",
      createdAt: now,
    });

    const txn = await getAt(`finance_transactions/${id}`);
    res.status(201).json(hydrate("finance_transactions", { id, ...txn }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

// PATCH /api/finance/transactions/:id
router.patch("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const txnSnap = await getAt(`finance_transactions/${id}`);
    if (!txnSnap || txnSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const updates: Record<string, any> = {};
    const allowed = ["amount", "title", "description", "category", "type", "date", "notes"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    await updateRow("finance_transactions", id, updates);
    const updatedSnap = await getAt(`finance_transactions/${id}`);
    res.json(hydrate("finance_transactions", { id, ...updatedSnap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// DELETE /api/finance/transactions/:id
router.delete("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const txnSnap = await getAt(`finance_transactions/${id}`);
    if (!txnSnap || txnSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    await removeRow("finance_transactions", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// GET /api/finance/categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const userCategories = (await findMany("finance_categories", "userId", req.user!.id))
      .map((c) => hydrate("finance_categories", c))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    res.json(userCategories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/finance/categories
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { name, type, color, icon, sortOrder } = req.body;
    if (!name?.trim() || !type) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await setRow("finance_categories", id, {
      userId: req.user!.id,
      name: name.trim(),
      type,
      color: color || "#FF8FAB",
      icon: icon || "Wallet",
      sortOrder: sortOrder || 0,
    });
    const cat = await getAt(`finance_categories/${id}`);
    res.status(201).json(hydrate("finance_categories", { id, ...cat }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

export default router;
