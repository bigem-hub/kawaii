import { create } from "zustand";
import { api } from "@/lib/api";
import {
  loadYoutubeApi,
  YT_STATES,
  type Track,
  type MusicProvider,
  type Playlist,
} from "@/lib/music";

/**
 * Global music state. The single YouTube player instance lives here so
 * playback survives navigating between tabs (the player host div is mounted
 * once in AppLayout). Spotify is an embed that the page renders itself.
 */
interface MusicData {
  favorites: Track[];
  playlists: Playlist[];
  recents: Track[];
}

interface MusicState extends MusicData {
  provider: MusicProvider;
  current: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  loading: boolean;
  volume: number;

  dataLoaded: boolean;
  setProvider: (p: MusicProvider) => void;
  /** Create the YT player on its host (idempotent). Returns the instance. */
  ensurePlayer: () => Promise<any>;
  play: (track: Track, queue?: Track[] | null, playIndex?: number) => Promise<void>;
  playQueue: (queue: Track[], index?: number) => Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (vol: number) => void;
  refreshData: () => Promise<void>;
  toggleFavorite: (track: Track) => Promise<void>;
  recordRecent: (track: Track) => void;
  savePlaylist: (p: { id?: string; name: string; items: Track[] }) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  resetRecent: () => Promise<void>;
}

let player: any = null;
let playerReadyPromise: Promise<any> | null = null;
const TICK_MS = 1000;

export const useMusic = create<MusicState>((set, get) => {
  const loadData = async () => {
    try {
      const data = await api.get<MusicData>("/music/data");
      set({
        favorites: data.favorites || [],
        playlists: data.playlists || [],
        recents: data.recents || [],
        dataLoaded: true,
      });
    } catch {
      set({ dataLoaded: true });
    }
  };

  const loadTrack = async (track: Track) => {
    set({ loading: true, current: track, isPlaying: false, position: 0, duration: 0 });
    // Update queueIndex if track matches an entry
    const { queue } = get();
    const idx = queue.findIndex((t) => t.id === track.id && t.provider === track.provider);
    set({ queueIndex: idx >= 0 ? idx : get().queueIndex });

    try {
      const p = await ensurePlayer();
      if (track.provider !== "youtube") return; // spotify handled by embed UI
      p.loadVideoById(track.id);
    } finally {
      set({ loading: false });
    }
  };

  return {
    provider: "youtube",
    current: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    position: 0,
    duration: 0,
    loading: false,
    volume: 70,
    favorites: [],
    playlists: [],
    recents: [],
    dataLoaded: false,

    setProvider: (p) => set({ provider: p }),
    ensurePlayer,

    playQueue: async (tracks, index = 0) => {
      const target = tracks[index];
      if (!target) return;
      set({ queue: tracks, queueIndex: index });
      if (target.provider !== "youtube") {
        set({ provider: "spotify", current: target, isPlaying: true });
        return;
      }
      set({ provider: "youtube" });
      await loadTrack(target);
      get().recordRecent(target);
    },

    play: async (track, queue = null, playIndex = -1) => {
      if (queue) {
        const idx = playIndex >= 0 ? playIndex : queue.findIndex((t) => t.id === track.id && t.provider === track.provider);
        await get().playQueue(queue, idx >= 0 ? idx : 0);
        return;
      }
      set({ queue: [track], queueIndex: 0 });
      if (track.provider !== "youtube") {
        set({ provider: "spotify", current: track, isPlaying: true });
        get().recordRecent(track);
        return;
      }
      set({ provider: "youtube" });
      await loadTrack(track);
      get().recordRecent(track);
    },

    toggle: () => {
      const { provider, isPlaying } = get();
      if (provider === "spotify" || !player || !get().current) return;
      if (isPlaying) player.pauseVideo();
      else player.playVideo();
    },

    next: () => {
      const { queue, queueIndex } = get();
      if (!queue.length) return;
      const nextIdx = (queueIndex + 1) % queue.length;
      get().playQueue(queue, nextIdx);
    },

    prev: () => {
      const { queue, queueIndex, position } = get();
      if (!queue.length) return;
      // Restart if >3s in, else go to previous track
      if (position > 3) {
        player.seekTo(0, true);
        return;
      }
      const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
      get().playQueue(queue, prevIdx);
    },

    seek: (sec) => {
      if (player && get().provider === "youtube") player.seekTo(sec, true);
    },

    setVolume: (vol) => {
      set({ volume: vol });
      if (player) player.setVolume(vol);
    },

    refreshData: loadData,
    recordRecent: (track) => {
      api.post("/music/recents", bestEffortTrack(track)).catch(() => {});
    },
    toggleFavorite: async (track) => {
      const { favorites } = get();
      const exists = favorites.some((f) => f.id === track.id && f.provider === track.provider);
      if (exists) {
        await api.delete(`/music/favorites/${track.id}`).catch(() => {});
        set({ favorites: favorites.filter((f) => !(f.id === track.id && f.provider === track.provider)) });
      } else {
        await api.post("/music/favorites", bestEffortTrack(track)).catch(() => {});
        const fav: Track = { ...track, duration: get().duration || track.duration };
        set({ favorites: [fav, ...favorites] });
      }
    },
    savePlaylist: async (p) => {
      if (p.id) {
        await api.patch(`/music/playlists/${p.id}`, { name: p.name, items: bestEffortList(p.items) }).catch(() => {});
        set({ playlists: get().playlists.map((pl) => (pl.id === p.id ? { ...pl, name: p.name, items: p.items } : pl)) });
      } else {
        const res = await api.post<{ playlist: Playlist }>("/music/playlists", { name: p.name }).catch(() => null);
        const id = res?.playlist?.id;
        if (id) {
          await api.patch(`/music/playlists/${id}`, { items: bestEffortList(p.items) }).catch(() => {});
          set({ playlists: [...get().playlists, { id, name: p.name, items: p.items, createdAt: Date.now() }] });
        }
      }
    },
    deletePlaylist: async (id) => {
      await api.delete(`/music/playlists/${id}`).catch(() => {});
      set({ playlists: get().playlists.filter((p) => p.id !== id) });
    },
    resetRecent: async () => {
      await Promise.all(
        get().recents.map((r) => api.delete(`/music/recents/${r.id}`).catch(() => {}))
      );
      set({ recents: [] });
    },
  };
});

async function ensurePlayer(): Promise<any> {
  if (player) return player;
  if (playerReadyPromise) return playerReadyPromise;

  playerReadyPromise = new Promise(async (resolve, reject) => {
    try {
      await loadYoutubeApi();
      const host = document.getElementById("kawaii-music-player");
      if (!host) throw new Error("Music player host not mounted");
      player = new window.YT.Player(host, {
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, autoplay: 1 },
        events: {
          onReady: () => {
            const vol = useMusic.getState().volume ?? 70;
            player.setVolume(vol);
            resolve(player);
          },
          onStateChange: (e: any) => {
            const st = YT_STATES[e.data];
            const s = useMusic.getState();
            if (st === "playing") {
              useMusic.setState({ isPlaying: true });
              try {
                const d = player.getDuration();
                if (d && isFinite(d)) useMusic.setState({ duration: d });
              } catch {}
            } else if (st === "paused") {
              useMusic.setState({ isPlaying: false });
            } else if (st === "ended") {
              const cur = useMusic.getState().current;
              if (cur?.provider === "youtube") {
                try {
                  const vd = player.getVideoData();
                  if (vd?.title && cur.title !== vd.title) {
                    useMusic.setState({ current: { ...cur, title: vd.title, artist: vd.author || cur.artist } });
                  }
                } catch {}
              }
              useMusic.setState({ isPlaying: false });
              s.next();
            } else if (st === "unstarted") {
              useMusic.setState({ isPlaying: false });
            }
          },
          onError: (e: any) => {
            console.error("YouTube Player Error:", e.data);
            useMusic.setState({ isPlaying: false, loading: false });
          },
        },
      });
    } catch (err) {
      playerReadyPromise = null;
      reject(err);
    }
  });

  const p = await playerReadyPromise;
  // Poll position when playing
  setInterval(() => {
    const st = useMusic.getState();
    if (!st.isPlaying || st.provider !== "youtube" || !player) return;
    try {
      useMusic.setState({ position: player.getCurrentTime() });
    } catch {}
  }, TICK_MS);
  return p;
}

function bestEffortTrack(t: Track): Track {
  return { ...t };
}
function bestEffortList(list: Track[]): Track[] {
  return list.map((t) => ({ ...t }));
}