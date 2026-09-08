import { useState } from "react";
import { Calculator, Clipboard, Delete, FlaskConical, History, Sigma, X } from "lucide-react";

type HistoryItem = { expression: string; result: string };

class ExpressionParser {
  private index = 0;
  private readonly tokens: string[];
  constructor(expression: string) {
    const normalized = expression.toLowerCase().replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/");
    const matches = normalized.match(/(?:\d*\.\d+|\d+\.?\d*|sin|cos|tan|sqrt|pi|e|[()+\-*/%^])/g) ?? [];
    if (matches.join("") !== normalized) throw new Error("Invalid expression");
    this.tokens = matches;
  }
  parse() { const value = this.additive(); if (this.index < this.tokens.length) throw new Error("Unexpected input"); return value; }
  private additive(): number { let value = this.multiplicative(); while (["+", "-"].includes(this.tokens[this.index])) { const op = this.tokens[this.index++]; const next = this.multiplicative(); value = op === "+" ? value + next : value - next; } return value; }
  private multiplicative(): number { let value = this.power(); while (["*", "/", "%"].includes(this.tokens[this.index])) { const op = this.tokens[this.index++]; const next = this.power(); if (op === "/" && next === 0) throw new Error("Cannot divide by zero"); value = op === "*" ? value * next : op === "/" ? value / next : value % next; } return value; }
  private power(): number { const value = this.unary(); if (this.tokens[this.index] === "^") { this.index += 1; return Math.pow(value, this.power()); } return value; }
  private unary(): number { if (this.tokens[this.index] === "-") { this.index += 1; return -this.unary(); } if (["sin", "cos", "tan", "sqrt"].includes(this.tokens[this.index])) { const fn = this.tokens[this.index++]; const value = this.unary(); if (fn === "sqrt" && value < 0) throw new Error("Invalid square root"); return fn === "sin" ? Math.sin(value) : fn === "cos" ? Math.cos(value) : fn === "tan" ? Math.tan(value) : Math.sqrt(value); } return this.primary(); }
  private primary(): number { const token = this.tokens[this.index++]; if (!token) throw new Error("Incomplete expression"); if (token === "(") { const value = this.additive(); if (this.tokens[this.index++] !== ")") throw new Error("Missing parenthesis"); return value; } if (token === "pi") return Math.PI; if (token === "e") return Math.E; const value = Number(token); if (!Number.isNaN(value)) return value; throw new Error("Unexpected input"); }
}

const BASIC_KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "%", "+", "="];
const SCIENTIFIC_KEYS = ["sin", "cos", "tan", "sqrt", "(", ")", "π", "e", "x²", "xʸ"];
const FORMULAS = [
  { title: "Kinematics", formula: "v = u + at", detail: "Final velocity after constant acceleration" },
  { title: "Distance", formula: "s = ut + ½at²", detail: "Displacement under constant acceleration" },
  { title: "Derivative", formula: "d(xⁿ)/dx = nxⁿ⁻¹", detail: "Power rule for differentiation" },
  { title: "Vector magnitude", formula: "|v| = √(x² + y² + z²)", detail: "Length of a 3D vector" },
];

function calculate(expression: string) {
  const result = new ExpressionParser(expression).parse();
  if (!Number.isFinite(result)) throw new Error("Result is not finite");
  return Number(result.toFixed(10)).toString();
}

export function ScientificCalculator({ compact = false }: { compact?: boolean }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"calculator" | "history" | "formulas">("calculator");
  const [scientific, setScientific] = useState(!compact);
  const [error, setError] = useState("");

  const append = (value: string) => { setExpression((current) => `${current}${value === "π" ? "pi" : value === "x²" ? "^2" : value === "xʸ" ? "^" : value}`); setError(""); };
  const evaluate = () => { try { const value = calculate(expression); setResult(value); setHistory((current) => [{ expression, result: value }, ...current.filter((item) => item.expression !== expression)].slice(0, 10)); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid expression"); } };
  const press = (key: string) => { if (key === "C") { setExpression(""); setResult("0"); setError(""); } else if (key === "⌫") setExpression((current) => current.slice(0, -1)); else if (key === "=") evaluate(); else append(key); };

  return <section className={`card overflow-hidden ${compact ? "w-80 shadow-kawaii-lg" : ""}`}><div className="p-4 bg-gradient-to-br from-[#30283d] to-[#55466e] text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Calculator size={17} /> Quick calc</div>{!compact && <button className="text-xs text-white/70 hover:text-white" onClick={() => setScientific((value) => !value)}>{scientific ? "Basic" : "Scientific"}</button>}</div><div className="mt-5 text-right"><div className="h-7 text-xs text-white/60 truncate">{expression || "Ready"}</div><div className="text-3xl font-bold tabular-nums truncate">{error || result}</div></div></div><div className="p-4"><div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-2)] mb-3">{(["calculator", "history", "formulas"] as const).map((key) => <button key={key} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold ${tab === key ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"}`} onClick={() => setTab(key)}>{key === "calculator" ? <Sigma size={14} className="mx-auto" /> : key === "history" ? <History size={14} className="mx-auto" /> : <FlaskConical size={14} className="mx-auto" />}</button>)}</div>{tab === "calculator" && <><div className="grid grid-cols-4 gap-2">{scientific && SCIENTIFIC_KEYS.map((key) => <button key={key} className="btn-secondary text-xs py-2" onClick={() => press(key)}>{key}</button>)}{["C", "⌫", ...BASIC_KEYS].map((key) => <button key={key} className={`text-sm font-bold rounded-xl py-2.5 transition-all active:scale-95 ${key === "=" ? "bg-[var(--accent)] text-white" : ["÷", "×", "-", "+", "%"].includes(key) ? "bg-[#ffe1eb] text-[#bc5273] dark:bg-pink-500/20 dark:text-pink-200" : "bg-[var(--surface-2)]"}`} onClick={() => press(key)}>{key === "⌫" ? <Delete size={15} className="mx-auto" /> : key}</button>)}</div><p className="text-[10px] text-[var(--text-muted)] mt-3">Scientific functions use radians. Example: sin(pi / 2)</p></>}{tab === "history" && <div className="space-y-2 min-h-48">{history.length === 0 ? <p className="text-sm text-[var(--text-muted)] text-center py-12">No calculations yet.</p> : history.map((item) => <button key={`${item.expression}-${item.result}`} className="w-full text-left p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--accent-soft)]" onClick={() => { setExpression(item.expression); setResult(item.result); setTab("calculator"); }}><div className="text-xs text-[var(--text-muted)]">{item.expression}</div><div className="font-bold">= {item.result}</div></button>)}</div>}{tab === "formulas" && <div className="space-y-2 min-h-48">{FORMULAS.map((item) => <button key={item.title} className="w-full text-left p-3 rounded-xl bg-[var(--surface-2)]" onClick={() => navigator.clipboard?.writeText(`${item.title}: ${item.formula}`)}><div className="text-xs text-[var(--accent)] font-semibold">{item.title}</div><div className="font-bold">{item.formula}</div><div className="text-[10px] text-[var(--text-muted)] mt-1">{item.detail}</div></button>)}<p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"><Clipboard size={12} /> Select a formula to copy it.</p></div>}</div></section>;
}

export function QuickCalcWidget() {
  const [open, setOpen] = useState(false);
  return <div className="fixed bottom-20 right-5 lg:bottom-6 z-30">{open && <div className="absolute bottom-14 right-0 mb-3"><div className="relative"><button className="absolute right-2 top-2 z-10 p-1.5 rounded-full bg-white/10 text-white" onClick={() => setOpen(false)} aria-label="Close calculator"><X size={14} /></button><ScientificCalculator compact /></div></div>}<button className="w-12 h-12 rounded-2xl bg-[#55466e] text-white shadow-kawaii-lg flex items-center justify-center hover:-translate-y-1 transition-transform" onClick={() => setOpen((value) => !value)} aria-label="Open quick calculator"><Calculator size={20} /></button></div>;
}
