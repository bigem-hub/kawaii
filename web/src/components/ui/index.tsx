import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className={`relative w-full ${maxWidth} card p-6 animate-bounce-in`}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={title || "Dialog"}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[var(--surface-2)] transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- ConfirmDialog ----------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div id="confirm-dialog-message">
        <p className="text-sm text-[var(--text-muted)] mb-5">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={danger ? "btn-danger" : "btn-primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---------- Skeleton ----------
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ---------- Skeleton loaders ----------
export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// ---------- EmptyState ----------
export function EmptyState({
  icon = "🌸",
  title,
  message,
  action,
}: {
  icon?: string | ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-6xl mb-4 animate-float">{typeof icon === "string" ? icon : <span className="block">{icon}</span>}</div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {message && (
        <p className="text-sm text-[var(--text-muted)] mb-5 max-w-sm">{message}</p>
      )}
      {action}
    </div>
  );
}

// ---------- Avatar ----------
export function Avatar({
  name,
  avatar,
  size = 40,
  online,
}: {
  name?: string;
  avatar?: string | null;
  size?: number;
  online?: boolean;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="rounded-full object-cover w-full h-full"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-bold text-white"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.4,
            background: `linear-gradient(135deg, var(--accent), #a78bfa)`,
          }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[var(--surface)] ${
            online ? "bg-green-500" : "bg-gray-400"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

// ---------- StatCard ----------
export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl bg-[var(--accent-soft)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[var(--text-muted)] text-xs">{label}</div>
        <div className="font-bold text-lg leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>}
      </div>
    </div>
  );
}

// ---------- Tag ----------
export function Tag({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="badge"
      style={
        color
          ? { background: `${color}22`, color }
          : { background: "var(--accent-soft)", color: "var(--accent)" }
      }
    >
      {children}
    </span>
  );
}

// ---------- ProgressBar ----------
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color || "linear-gradient(135deg, var(--accent), #a78bfa)" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

// ---------- Toast (wrapper for react-hot-toast) ----------
export { toast } from "react-hot-toast";

// ---------- Spinner ----------
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />;
}

// ---------- LoadingButton ----------
export function LoadingButton({
  loading,
  children,
  loadingText,
  className = "",
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <button
      {...rest}
      className={`btn-primary ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <Spinner size={16} /> {loadingText || children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
