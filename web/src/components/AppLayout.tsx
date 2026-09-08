import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/store/useAuth";
import { Avatar } from "@/components/ui";
import {
  Home,
  CheckSquare,
  GraduationCap,
  BookOpen,
  MessageCircle,
  Users,
  Dumbbell,
  Calendar,
  Tv,
  BarChart3,
  User,
  Settings,
  Search,
  Menu,
  X,
  Bell,
  CheckCheck,
  Sparkles,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { format } from "date-fns";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/notes", icon: BookOpen, label: "Notes" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/finance", icon: Wallet, label: "Finance" },
  { to: "/fitness", icon: Dumbbell, label: "Fitness" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/watch", icon: Tv, label: "Watch" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
];

const bottomNav = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/fitness", icon: Dumbbell, label: "Fit" },
  { to: "/friends", icon: Users, label: "Friends" },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    api.get<{ count: number }>("/notifications/unread-count")
      .then((d) => setUnreadCount(d.count))
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    if (!showNotifs) return;
    api.get<any[]>("/notifications")
      .then((d) => setNotifications(d))
      .catch(() => {});
  }, [showNotifs]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    setUnreadCount(0);
    setNotifications((n) => n.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="text-[var(--accent)]"><Sparkles size={28} /></div>
            <div>
              <h1 className="font-bold text-lg leading-tight gradient-text">KawaiiLife</h1>
              <div className="text-[10px] text-[var(--text-muted)]">Productivity & Social</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)] space-y-1">
          <SidebarLink to="/profile" icon={User} label="Profile" />
          <SidebarLink to="/settings" icon={Settings} label="Settings" />
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
{/* User card */}
        <div className="p-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Avatar name={user?.displayName} avatar={user?.avatar} size={36} online={true} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{user?.displayName}</div>
              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                <span>Lv.{user?.level || 1} &middot; {user?.xp || 0} XP</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${((user?.xp || 0) % 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setSidebarOpen(true)} className="p-2">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent)]"><Sparkles size={24} /></span>
            <span className="font-bold gradient-text">KawaiiLife</span>
          </div>
          <div className="flex items-center gap-1">
            <NavLink to="/search" className="p-2">
              <Search size={20} />
            </NavLink>
            <div className="relative" ref={notifRef}>
              <button
                className="p-2 relative"
                onClick={() => setShowNotifs(!showNotifs)}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NotifDropdown
                open={showNotifs}
                notifications={notifications}
                onMarkAll={markAllRead}
                onClose={() => setShowNotifs(false)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--surface)] p-4 shadow-2xl overflow-y-auto"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--accent)]"><Sparkles size={26} /></span>
                  <span className="font-bold gradient-text text-lg">KawaiiLife</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <SidebarLink
                    key={item.to}
                    {...item}
                    onClick={() => setSidebarOpen(false)}
                  />
                ))}
                <div className="border-t border-[var(--border)] my-2" />
                <SidebarLink
                  to="/profile"
                  icon={User}
                  label="Profile"
                  onClick={() => setSidebarOpen(false)}
                />
                <SidebarLink
                  to="/settings"
                  icon={Settings}
                  label="Settings"
                  onClick={() => setSidebarOpen(false)}
                />
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  Sign Out
                </button>
              </nav>
<div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-3">
                <Avatar name={user?.displayName} avatar={user?.avatar} size={40} online={true} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{user?.displayName}</div>
                  <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                    <span>@{user?.username} &middot; Lv.{user?.level || 1}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${((user?.xp || 0) % 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-h-screen lg:pb-0 pb-16 pt-14 lg:pt-0">
        {/* Desktop top bar with notification bell */}
        <div className="hidden lg:flex items-center justify-end px-6 py-3 border-b border-[var(--border)] sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <NavLink to="/search" className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
              <Search size={18} className="text-[var(--text-muted)]" />
            </NavLink>
            <div className="relative" ref={notifRef}>
              <button
                className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors relative"
                onClick={() => setShowNotifs(!showNotifs)}
              >
                <Bell size={18} className="text-[var(--text-muted)]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NotifDropdown
                open={showNotifs}
                notifications={notifications}
                onMarkAll={markAllRead}
                onClose={() => setShowNotifs(false)}
              />
            </div>
            <Link to="/profile" className="p-1 rounded-full hover:ring-2 hover:ring-[var(--accent)] transition-all">
              <Avatar name={user?.displayName} avatar={user?.avatar} size={32} online={true} />
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-[var(--border)]">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
              >
                <item.icon
                  size={22}
                  className={active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}
                />
                <span
                  className={`text-[10px] font-semibold ${
                    active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NotifDropdown({
  open,
  notifications,
  onMarkAll,
  onClose,
}: {
  open: boolean;
  notifications: any[];
  onMarkAll: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute right-0 top-10 w-80 card shadow-kawaii-lg z-50 overflow-hidden"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-bold text-sm flex items-center gap-2"><Bell size={16} /> Notifications</span>
            <button
              className="text-xs text-[var(--accent)] font-semibold flex items-center gap-1 hover:underline"
              onClick={onMarkAll}
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                <div className="mb-2 text-[var(--accent)] flex justify-center"><CheckCheck size={32} /></div>
                All caught up!
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-3 py-2.5 border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-2)] ${
                    !n.read ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  <span className="mt-0.5 text-[var(--accent)]">
                    {n.type === "message" ? <MessageCircle size={18} /> :
                     n.type === "friend" ? <Users size={18} /> :
                     n.type === "task" ? <CheckSquare size={18} /> :
                     n.type === "note" ? <BookOpen size={18} /> :
                     n.type === "reminder" ? <Bell size={18} /> : <Sparkles size={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight">{n.title}</div>
                    {n.body && <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{n.body}</div>}
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      {format(new Date(n.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: any;
  label: string;
  onClick?: () => void;
}) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      }`}
    >
      <Icon size={20} className={active ? "text-[var(--accent)]" : ""} />
      {label}
    </NavLink>
  );
}
