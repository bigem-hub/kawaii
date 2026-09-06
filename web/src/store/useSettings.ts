import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  theme: "light" | "dark" | "system";
  accent: string;
  density: string;
  animations: boolean;
  setTheme: (t: "light" | "dark" | "system") => void;
  setAccent: (c: string) => void;
  setDensity: (d: string) => void;
  setAnimations: (a: boolean) => void;
}

export const useThemeStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      accent: "#ff8fab",
      density: "comfortable",
      animations: true,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setDensity: (density) => set({ density }),
      setAnimations: (animations) => set({ animations }),
    }),
    {
      name: "kawaiilife-settings",
    }
  )
);

export const useSettings = useThemeStore;

export const ACCENT_COLORS = [
  { name: "Blush", color: "#ff8fab" },
  { name: "Lavender", color: "#a78bfa" },
  { name: "Sky", color: "#60a5fa" },
  { name: "Mint", color: "#34d399" },
  { name: "Peach", color: "#fb923c" },
  { name: "Rose", color: "#f472b6" },
  { name: "Lilac", color: "#c084fc" },
  { name: "Teal", color: "#2dd4bf" },
];
