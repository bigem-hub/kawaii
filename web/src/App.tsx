import { useEffect, type ReactElement } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/store/useAuth";
import { useThemeStore } from "@/store/useSettings";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AppLayout } from "@/components/AppLayout";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import Notes from "@/pages/Notes";
import NoteEditor from "@/pages/NoteEditor";
import Chat from "@/pages/Chat";
import Friends from "@/pages/Friends";
import Fitness from "@/pages/Fitness";
import CalendarPage from "@/pages/CalendarPage";
import WatchTogether from "@/pages/WatchTogether";
import WatchRoom from "@/pages/WatchRoom";
import Analytics from "@/pages/Analytics";
import Profile from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import Search from "@/pages/Search";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, initialized } = useAuth();
  if (!initialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { init, initialized } = useAuth();
  const { theme, accent } = useThemeStore();

  // Apply theme
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle("dark", isDark);
    };
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      applyTheme(theme === "dark");
    }
  }, [theme]);

  // Apply accent color
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    // Derive soft accent from accent color
    document.documentElement.style.setProperty(
      "--accent-soft",
      accent + "26"
    );
  }, [accent]);

  // Init auth on load
  useEffect(() => {
    init();
  }, []);

  // Listen for forced logout
  useEffect(() => {
    const handler = () => {
      window.location.href = "/login";
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  if (!initialized) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="notes" element={<Notes />} />
        <Route path="notes/:id" element={<NoteEditor />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:id" element={<Chat />} />
        <Route path="friends" element={<Friends />} />
        <Route path="friends/:username" element={<Profile />} />
        <Route path="fitness" element={<Fitness />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="watch" element={<WatchTogether />} />
        <Route path="watch/:code" element={<WatchRoom />} />
        <Route path="stats" element={<Analytics />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="search" element={<Search />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}