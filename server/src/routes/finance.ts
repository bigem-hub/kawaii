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
    // Track current-month spending per category so budget progress can be computed.
    const monthExpenseByCategory: Record<string, number> = {};

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
        else {
          monthExpense += t.amount;
          monthExpenseByCategory[t.category] =
            (monthExpenseByCategory[t.category] || 0) + t.amount;
        }
      }
    }

    // --- Budgets -----------------------------------------------------------
    // INVARIANT: allocated budgets are a strict SPENDING ALLOWANCE. They are
    // computed independently and are NEVER added to balance, totalIncome, or
    // monthIncome. Total Income reflects only real money earned/received.
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const budgets = (await findMany("finance_budgets", "userId", userId))
      .map((b) => hydrate("finance_budgets", b))
      .filter((b) => b.month === monthKey);

    const totalBudget = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const budgetRemaining = totalBudget - monthExpense;
    const budgetsByCategory = budgets.map((b) => {
      const budget = Number(b.amount) || 0;
      const spent = monthExpenseByCategory[b.category] || 0;
      return { id: b.id, category: b.category, budget, spent, remaining: budget - spent };
    });

    res.json({
      balance,
      totalIncome,
      totalExpense,
      monthIncome,
      monthExpense,
      totalBudget,
      budgetSpent: monthExpense,
      budgetRemaining,
      budgetsByCategory,
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

    const numericAmount = Number(amount);
    if (!["income", "expense"].includes(type)) {
      res.status(400).json({ error: "Type must be 'income' or 'expense'" });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    await setRow("finance_transactions", id, {
      userId: req.user!.id,
      amount: numericAmount,
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

// ============ BUDGETS ============
// Monthly spending allowances per expense category. Budgets are a planning
// tool only — they are NEVER income and never affect balance.

function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/finance/budgets
router.get("/budgets", async (req: Request, res: Response) => {
  try {
    const { month } = req.query;
    let budgets = (await findMany("finance_budgets", "userId", req.user!.id))
      .map((b) => hydrate("finance_budgets", b))
      .sort((a: any, b: any) => (a.category || "").localeCompare(b.category || ""));
    if (month) budgets = budgets.filter((b) => b.month === String(month));
    res.json(budgets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

// POST /api/finance/budgets  (creates or replaces the budget for (category, month))
router.post("/budgets", async (req: Request, res: Response) => {
  try {
    const { category, amount, month } = req.body;
    if (!category?.trim() || amount === undefined) {
      res.status(400).json({ error: "Category and amount are required" });
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }
    const budgetMonth = month || currentMonthKey();

    // Idempotent upsert per (category, month) — one budget per category per month.
    const existing = (await findMany("finance_budgets", "userId", req.user!.id))
      .filter((b: any) => b.category === category && b.month === budgetMonth);
    if (existing.length > 0) {
      const id = existing[0].id;
      await updateRow("finance_budgets", id, {
        amount: numericAmount,
        updatedAt: Date.now(),
      });
      const snap = await getAt(`finance_budgets/${id}`);
      res.json(hydrate("finance_budgets", { id, ...snap }));
      return;
    }

    const id = uuid();
    await setRow("finance_budgets", id, {
      userId: req.user!.id,
      category: category.trim(),
      amount: numericAmount,
      month: budgetMonth,
      createdAt: Date.now(),
    });
    const snap = await getAt(`finance_budgets/${id}`);
    res.status(201).json(hydrate("finance_budgets", { id, ...snap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create budget" });
  }
});

// PATCH /api/finance/budgets/:id
router.patch("/budgets/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const snap = await getAt(`finance_budgets/${id}`);
    if (!snap || snap.userId !== req.user!.id) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (req.body.amount !== undefined) {
      const numericAmount = Number(req.body.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ error: "Amount must be a positive number" });
        return;
      }
      updates.amount = numericAmount;
    }
    if (req.body.category !== undefined) {
      if (!String(req.body.category).trim()) {
        res.status(400).json({ error: "Category cannot be empty" });
        return;
      }
      updates.category = req.body.category;
    }
    await updateRow("finance_budgets", id, updates);
    const updatedSnap = await getAt(`finance_budgets/${id}`);
    res.json(hydrate("finance_budgets", { id, ...updatedSnap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

// DELETE /api/finance/budgets/:id
router.delete("/budgets/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const snap = await getAt(`finance_budgets/${id}`);
    if (!snap || snap.userId !== req.user!.id) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }
    await removeRow("finance_budgets", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
