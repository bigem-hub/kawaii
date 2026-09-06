import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { useSettings, ACCENT_COLORS } from "@/store/useSettings";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor, Palette, Bell, Shield, User, LogOut } from "lucide-react";

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const { theme, setTheme, accent, setAccent } = useSettings();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const profileMutation = useMutation({
    mutationFn: (data: any) => api.patch("/auth/profile", data),
    onSuccess: (updated: any) => {
      updateProfile(updated);
      toast.success("Profile updated! ✨");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => api.patch("/auth/profile", data),
    onSuccess: () => {
      toast.success("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setShowPassword(false);
    },
  });

  return (
    <motion.div className="max-w-2xl mx-auto space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold">Settings ⚙️</h1>

      {/* Profile Section */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><User size={18} /> Profile</h3>
        <div>
          <label className="label">Display Name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[60px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." />
        </div>
        <button
          className="btn-primary"
          onClick={() => profileMutation.mutate({ displayName, bio })}
          disabled={profileMutation.isPending}
        >
          Save Profile
        </button>
      </div>

      {/* Theme Section */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Palette size={18} /> Appearance</h3>
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-2">
            {[
              { value: "light", icon: <Sun size={18} />, label: "Light" },
              { value: "dark", icon: <Moon size={18} />, label: "Dark" },
              { value: "system", icon: <Monitor size={18} />, label: "System" },
            ].map((t) => (
              <button
                key={t.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  theme === t.value
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]/80"
                }`}
                onClick={() => setTheme(t.value as any)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Accent Color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.color}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c.color, borderColor: accent === c.color ? "var(--text)" : "transparent" }}
                onClick={() => setAccent(c.color)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Shield size={18} /> Security</h3>
        <button className="btn-secondary text-sm" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "Cancel" : "Change Password"}
        </button>
        {showPassword && (
          <div className="space-y-3">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                if (!currentPassword || !newPassword) return toast.error("Both fields required");
                if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
                passwordMutation.mutate({ currentPassword, password: newPassword });
              }}
              disabled={passwordMutation.isPending}
            >
              Update Password
            </button>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <div className="card p-5">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 transition-colors"
          onClick={() => {
            if (confirm("Are you sure you want to sign out?")) {
              logout();
            }
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </motion.div>
  );
}