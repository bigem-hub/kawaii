import { create } from "zustand";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string | null;
  bio?: string;
  online?: boolean;
  xp?: number;
  level?: number;
  streak?: number;
  longestStreak?: number;
  createdAt?: number;
  lastActivityDate?: string;
  profile?: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ initialized: true, user: null });
      return;
    }
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      set({ user: data.user, token, initialized: true });
      connectSocket(token);
    } catch {
      localStorage.removeItem("token");
      set({ user: null, token: null, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const data = await api.post<{ user: User; token: string }>("/auth/login", {
        email,
        password,
      });
      localStorage.setItem("token", data.token);
      connectSocket(data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const res = await api.post<{ user: User; token: string }>("/auth/register", data);
      localStorage.setItem("token", res.token);
      connectSocket(res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    const token = localStorage.getItem("token");
    try {
      if (token) await api.post("/auth/logout");
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    disconnectSocket();
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),

  updateProfile: async (data) => {
    await api.patch("/auth/profile", data);
    const current = get().user;
    set({ user: { ...current, ...data } as User });
  },
}));
