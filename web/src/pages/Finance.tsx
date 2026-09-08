import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Edit2, Search, Filter, Calendar, PieChart, BarChart2, Download, ChevronDown } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui";
import { formatRs } from "@/lib/currency";
import { errMessage } from "@/lib/api";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface Transaction {
  id: string;
  amount: number;
  title: string;
  description: string;
  category: string;
  type: "income" | "expense";
  date: string;
}

interface Summary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  monthIncome: number;
  monthExpense: number;
  totalBudget: number;
  budgetSpent: number;
  budgetRemaining: number;
  budgetsByCategory: { id: string; category: string; budget: number; spent: number; remaining: number }[];
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  month: string;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
}

type DateFilter = "today" | "week" | "month" | "year" | "custom";

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const EXPENSE_CATEGORIES = [
  "food", "transportation", "shopping", "entertainment", "education",
  "bills", "health", "travel", "subscriptions", "housing", "other"
];

const INCOME_CATEGORIES = [
  "salary", "freelance", "business", "allowance", "investment", "other"
];

const CATEGORY_COLORS: Record<string, string> = {
  food: "#FF6B6B",
  transportation: "#4ECDC4",
  shopping: "#45B7D1",
  entertainment: "#96CEB4",
  education: "#FFEAA7",
  bills: "#DDA0DD",
  health: "#98D8C8",
  travel: "#F7DC6F",
  subscriptions: "#BB8FCE",
  housing: "#85C1E9",
  salary: "#2ECC71",
  freelance: "#27AE60",
  business: "#1E8A49",
  allowance: "#58D68D",
  investment: "#148F77",
  other: "#BDC3C7",
};

export default function Finance() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    type: "expense",
    category: "other",
    date: new Date().toISOString().split("T")[0],
  });

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: "food", amount: "" });

  const { data: summary, isLoading: loadingSummary } = useQuery<Summary>({
    queryKey: ["finance", "summary"],
    queryFn: () => api.get("/finance/summary"),
  });

  const { data: transactions, isLoading: loadingTxns } = useQuery<Transaction[]>({
    queryKey: ["finance", "transactions"],
    queryFn: () => api.get("/finance/transactions"),
  });

  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["finance", "categories"],
    queryFn: () => api.get("/finance/categories"),
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["finance", "budgets"],
    queryFn: () => api.get("/finance/budgets"),
  });

  // Filter transactions based on date filter, type, category, and search
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    switch (dateFilter) {
      case "today":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "custom":
        if (customStartDate) startDate = startOfDay(new Date(customStartDate));
        if (customEndDate) endDate = endOfDay(new Date(customEndDate));
        break;
    }

    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      if (txnDate < startDate || txnDate > endDate) return false;
      if (typeFilter !== "all" && txn.type !== typeFilter) return false;
      if (categoryFilter && txn.category !== categoryFilter) return false;
      if (search && !txn.title.toLowerCase().includes(search.toLowerCase()) && 
          !txn.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, dateFilter, customStartDate, customEndDate, typeFilter, categoryFilter, search]);

  // Calculate filtered summary
  const filteredSummary = useMemo(() => {
    let balance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    for (const t of filteredTransactions) {
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

    return { balance, totalIncome, totalExpense, monthIncome, monthExpense };
  }, [filteredTransactions]);

  // Expense by category for pie chart
  const expenseByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      });
    return Object.entries(categoryMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
    }));
  }, [filteredTransactions]);

  // Income by category for pie chart
  const incomeByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === "income")
      .forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      });
    return Object.entries(categoryMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
    }));
  }, [filteredTransactions]);

  // Weekly/Monthly trend data
  const trendData = useMemo(() => {
    const data: Record<string, { income: number; expense: number }> = {};
    
    if (dateFilter === "week") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const key = format(date, "EEE");
        data[key] = { income: 0, expense: 0 };
      }
      filteredTransactions.forEach(t => {
        const key = format(new Date(t.date), "EEE");
        if (data[key]) {
          if (t.type === "income") data[key].income += t.amount;
          else data[key].expense += t.amount;
        }
      });
    } else if (dateFilter === "month") {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i * 7);
        const key = `Week ${4 - i}`;
        data[key] = { income: 0, expense: 0 };
      }
      filteredTransactions.forEach(t => {
        const tDate = new Date(t.date);
        const weekNum = Math.floor((tDate.getDate() - 1) / 7) + 1;
        const key = `Week ${weekNum}`;
        if (data[key]) {
          if (t.type === "income") data[key].income += t.amount;
          else data[key].expense += t.amount;
        }
      });
    } else if (dateFilter === "year") {
      // Last 12 months
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const key = format(d, "MMM");
        data[key] = { income: 0, expense: 0 };
      }
      filteredTransactions.forEach(t => {
        const key = format(new Date(t.date), "MMM");
        if (data[key]) {
          if (t.type === "income") data[key].income += t.amount;
          else data[key].expense += t.amount;
        }
      });
    }

    return Object.entries(data).map(([name, values]) => ({
      name,
      income: values.income,
      expense: values.expense,
    }));
  }, [filteredTransactions, dateFilter]);

  // Get available categories based on type
  const availableCategories = useMemo(() => {
    if (typeFilter === "income") return INCOME_CATEGORIES;
    if (typeFilter === "expense") return EXPENSE_CATEGORIES;
    return [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  }, [typeFilter]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/finance/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/finance/transactions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: { category: string; amount: number }) =>
      api.post("/finance/budgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Budget saved");
      setBudgetModalOpen(false);
      setBudgetForm({ category: "food", amount: "" });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Budget removed");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(budgetForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid budget amount");
      return;
    }
    createBudgetMutation.mutate({ category: budgetForm.category, amount });
  };

  const handleOpenModal = (txn?: Transaction) => {
    if (txn) {
      setEditingTxn(txn);
      setFormData({
        title: txn.title,
        amount: String(txn.amount),
        type: txn.type,
        category: txn.category,
        date: txn.date,
      });
    } else {
      setEditingTxn(null);
      setFormData({
        title: "",
        amount: "",
        type: "expense",
        category: "other",
        date: new Date().toISOString().split("T")[0],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTxn(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTxn) {
      updateMutation.mutate({ id: editingTxn.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary) return;
    const targetBalance = parseFloat(newBalance);
    if (isNaN(targetBalance)) return;
    
    const diff = targetBalance - summary.balance;
    if (diff === 0) {
      setIsBalanceModalOpen(false);
      return;
    }

    createMutation.mutate({
      title: "Balance Adjustment",
      amount: Math.abs(diff),
      type: diff > 0 ? "income" : "expense",
      category: "other",
      date: new Date().toISOString().split("T")[0],
    });
    setIsBalanceModalOpen(false);
    setNewBalance("");
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Wallet className="text-[var(--accent)]" /> Finance
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage your income and expenses.</p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <button 
              className="btn-secondary flex items-center gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} /> Filters
              <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} />
            </button>
          </div>
          
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Period:</label>
                <select
                  className="input text-sm py-1.5"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                >
                  {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              
              {/* Custom date range */}
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="input text-sm py-1.5 w-40"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    placeholder="Start"
                  />
                  <span className="text-[var(--text-muted)]">to</span>
                  <input
                    type="date"
                    className="input text-sm py-1.5 w-40"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    placeholder="End"
                  />
                </div>
              )}
              
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Type:</label>
                <select
                  className="input text-sm py-1.5"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
                >
                  <option value="all">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Category:</label>
                <select
                  className="input text-sm py-1.5 w-40"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          <div className="relative w-full sm:w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input
              type="text"
              placeholder="Search transactions..."
              className="input pl-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6 relative">
            <div className="text-sm font-medium text-[var(--text-muted)] flex items-center justify-between">
              <span className="flex items-center gap-2"><Wallet size={16} /> Total Balance</span>
              <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => { setNewBalance(filteredSummary.balance.toFixed(2)); setIsBalanceModalOpen(true); }}>Adjust</button>
            </div>
            <div className="text-3xl font-bold mt-2">
              {formatRs(filteredSummary.balance)}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {filteredSummary.balance >= 0 ? "Positive" : "Negative"} balance
            </p>
          </div>
          <div className="card p-6 border-b-4 border-green-500">
            <div className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <TrendingUp size={16} className="text-green-500" /> Income
            </div>
            <div className="text-3xl font-bold mt-2 text-green-500">
              +{formatRs(filteredSummary.totalIncome)}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">This period</p>
          </div>
          <div className="card p-6 border-b-4 border-red-500">
            <div className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" /> Expenses
            </div>
            <div className="text-3xl font-bold mt-2 text-red-500">
              -{formatRs(filteredSummary.totalExpense)}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">This period</p>
          </div>
        </div>
      )}

      {/* Budgets */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold flex items-center gap-2"><Wallet size={18} className="text-[var(--accent)]" /> Monthly Budgets</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Budgets are a spending allowance and are never counted as income or balance.
            </p>
          </div>
          <button className="btn-secondary text-sm" onClick={() => setBudgetModalOpen(true)}>
            <Plus size={14} /> Add Budget
          </button>
        </div>
        {budgets.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-2">
            No budgets set. Add a budget to track spending against an allowance per category.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {budgets.map((b) => {
              const spent = summary?.budgetsByCategory?.find((x) => x.category === b.category)?.spent ?? 0;
              const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
              const over = spent > b.amount;
              return (
                <div key={b.id} className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm capitalize">{b.category}</span>
                    <button
                      onClick={() => deleteBudgetMutation.mutate(b.id)}
                      className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      aria-label={`Remove ${b.category} budget`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
                    <span className={over ? "text-red-500 font-semibold" : ""}>
                      {formatRs(spent)} spent
                    </span>
                    <span>of {formatRs(b.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-[var(--accent)]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`text-[11px] mt-1 ${over ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                    {over ? `${formatRs(spent - b.amount)} over budget` : `${formatRs(b.amount - spent)} remaining`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      {(expenseByCategory.length > 0 || incomeByCategory.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Expense Pie Chart */}
          {expenseByCategory.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <PieChart className="text-red-500" size={20} /> Expenses by Category
                </h2>
                <span className="text-xs text-[var(--text-muted)]">{expenseByCategory.length} categories</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {expenseByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatRs(value), ""]}
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {expenseByCategory.map((entry) => (
                  <span
                    key={entry.name}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                    style={{ borderColor: entry.color, color: entry.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Income Pie Chart */}
          {incomeByCategory.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <PieChart className="text-green-500" size={20} /> Income by Category
                </h2>
                <span className="text-xs text-[var(--text-muted)]">{incomeByCategory.length} categories</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {incomeByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatRs(value), ""]}
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {incomeByCategory.map((entry) => (
                  <span
                    key={entry.name}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                    style={{ borderColor: entry.color, color: entry.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Income vs Expense Trend Chart */}
      {trendData.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <BarChart2 size={20} className="text-[var(--accent)]" /> Income vs Expenses Trend
            </h2>
            <span className="text-xs text-[var(--text-muted)]">{dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)} view</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={60} />
                <Tooltip
                  formatter={(value: number) => [formatRs(value), ""]}
                  contentStyle={{
                    backgroundColor: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                  }}
                />
                <Bar dataKey="income" fill="#2ECC71" radius={[0, 4, 4, 0]} name="Income" />
                <Bar dataKey="expense" fill="#E74C3C" radius={[0, 4, 4, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              className="card w-full max-w-md p-6 bg-[var(--bg)]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2 className="text-xl font-bold mb-4">
                {editingTxn ? "Edit Transaction" : "New Transaction"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${formData.type === "expense" ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                      onClick={() => setFormData({ ...formData, type: "expense", category: EXPENSE_CATEGORIES[0] })}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${formData.type === "income" ? "border-green-500 bg-green-50 text-green-600 dark:bg-green-500/10" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                      onClick={() => setFormData({ ...formData, type: "income", category: INCOME_CATEGORIES[0] })}
                    >
                      Income
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Title</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Groceries, Salary, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Amount</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="input w-full"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Date</label>
                    <input
                      type="date"
                      required
                      className="input w-full"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Category</label>
                  <select
                    className="input w-full"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingTxn ? "Update" : "Save"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isBalanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              className="card w-full max-w-sm p-6 bg-[var(--bg)]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2 className="text-xl font-bold mb-4">Adjust Balance</h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                This will create an adjustment transaction to match your target balance.
              </p>
              <form onSubmit={handleBalanceSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Target Balance</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    className="input w-full"
                    value={newBalance}
                    onChange={e => setNewBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setIsBalanceModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {budgetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              className="card w-full max-w-sm p-6 bg-[var(--bg)]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h2 className="text-xl font-bold mb-4">Add Monthly Budget</h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Set a spending allowance for a category this month. Budgets never count toward income or balance.
              </p>
              <form onSubmit={handleBudgetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Category</label>
                  <select
                    className="input w-full"
                    value={budgetForm.category}
                    onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="input w-full"
                    value={budgetForm.amount}
                    onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setBudgetModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={createBudgetMutation.isPending}>
                    {createBudgetMutation.isPending ? "Saving..." : "Save Budget"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
