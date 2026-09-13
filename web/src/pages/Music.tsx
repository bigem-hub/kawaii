import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Youtube,
  Music2,
  Search,
  Link2,
  Play,
  Pause,
  Heart,
  Sparkles,
  History,
  ListMusic,
  Plus,
  Trash2,
  Disc3,
  X,
} from "lucide-react";
import { toast, Tag } from "@/components/ui";
import { useMusic } from "@/store/useMusic";
import {
  CURATED_RADIOS,
  curatedQueue,
  canSearch,
  searchYoutube,
  parseYoutubeUrl,
  parseSpotifyUrl,
  resolveYoutubeLink,
  radioToTrack,
  type Track,
} from "@/lib/music";
import { NowPlaying } from "@/components/music/NowPlaying";

export default function Music() {
  const provider = useMusic((s) => s.provider);
  const setProvider = useMusic((s) => s.setProvider);
  const current = useMusic((s) => s.current);
  const isPlaying = useMusic((s) => s.isPlaying);
  const queue = useMusic((s) => s.queue);
  const queueIndex = useMusic((s) => s.queueIndex);
  const playQueue = useMusic((s) => s.playQueue);
  const play = useMusic((s) => s.play);
  const toggle = useMusic((s) => s.toggle);
  const next = useMusic((s) => s.next);
  const prev = useMusic((s) => s.prev);
  const favorites = useMusic((s) => s.favorites);
  const toggleFavorite = useMusic((s) => s.toggleFavorite);
  const recents = useMusic((s) => s.recents);
  const resetRecent = useMusic((s) => s.resetRecent);
  const playlists = useMusic((s) => s.playlists);
  const savePlaylist = useMusic((s) => s.savePlaylist);
  const deletePlaylist = useMusic((s) => s.deletePlaylist);

  const [query, setQuery] = useState("");
  const [link, setLink] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [saving, setSaving] = useState(false);
  const [playlistName, setPlaylistName] = useState("");

  // Keyboard shortcuts: space = play/pause, arrows = next/prev (YouTube only)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (provider !== "youtube") return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [provider, toggle, next, prev]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await searchYoutube(query);
      setResults(r);
      if (r.length === 0) toast("No results found");
    } catch (e: any) {
      toast(e?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handlePasteLink = async () => {
    const l = link.trim();
    if (!l) return;
    const ytId = parseYoutubeUrl(l);
    if (ytId) {
      const track = await resolveYoutubeLink(l);
      if (track) {
        await play(track);
        toast("Now playing on YouTube");
      }
      setLink("");
      return;
    }
    const sp = parseSpotifyUrl(l);
    if (sp && sp.type === "track") {
      const track: Track = {
        id: sp.id,
        provider: "spotify",
        title: l,
        artist: "Spotify",
        thumbnail: "https://i.scdn.co/image/ab67616d0000b273000000000000000000000000",
        url: l,
      };
      setProvider("spotify");
      await play(track);
      toast("Opened in Spotify");
      setLink("");
      return;
    }
    toast("That doesn't look like a YouTube or Spotify link");
  };

  const saveCurrentQueue = async () => {
    if (!queue.length) {
      toast("Nothing in the queue to save");
      return;
    }
    setSaving(true);
    try {
      await savePlaylist({ name: playlistName.trim() || `Playlist ${playlists.length + 1}`, items: queue });
      setPlaylistName("");
      toast("Playlist saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Disc3 className="text-[var(--accent)]" /> Music
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Stream while you study — playback keeps going in any tab.
          </p>
        </div>
        {/* Provider toggle */}
        <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] w-fit">
          <ProviderBtn
            active={provider === "youtube"}
            onClick={() => setProvider("youtube")}
            icon={<Youtube size={16} />}
            label="YouTube"
          />
          <ProviderBtn
            active={provider === "spotify"}
            onClick={() => setProvider("spotify")}
            icon={<Music2 size={16} />}
            label="Spotify"
          />
        </div>
      </div>

      {/* Search + paste link */}
      <div className="grid md:grid-cols-2 gap-3">
        {canSearch ? (
          <div className="card p-3 flex items-center gap-2">
            <Search size={18} className="text-[var(--text-muted)] ml-1 shrink-0" />
            <input
              className="input !border-0 !bg-transparent !shadow-none flex-1 min-w-0"
              placeholder="Search YouTube…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
            />
            <button
              onClick={doSearch}
              disabled={searching || !query.trim()}
              className="btn-primary !px-4 !py-2 text-sm shrink-0"
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        ) : (
          <Tag color="#ff8fab">🔍 Add a VITE_YOUTUBE_API_KEY to enable search</Tag>
        )}
        <div className="card p-3 flex items-center gap-2">
          <Link2 size={18} className="text-[var(--text-muted)] ml-1 shrink-0" />
          <input
            className="input !border-0 !bg-transparent !shadow-none flex-1 min-w-0"
            placeholder="Paste a YouTube / Spotify link…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasteLink()}
          />
          <button onClick={handlePasteLink} disabled={!link.trim()} className="btn-secondary !px-4 !py-2 text-sm shrink-0">
            Play
          </button>
        </div>
      </div>

      {/* Now playing */}
      <NowPlaying />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left / main column: curated + search results + queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Curated radios */}
          <Section title="Start with a curated station" icon={<Sparkles size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CURATED_RADIOS.map((r) => {
                const track = radioToTrack(r);
                const active = current?.id === r.videoId && provider === "youtube";
                return (
                  <button
                    key={r.videoId}
                    onClick={() => playQueue(curatedQueue(), CURATED_RADIOS.indexOf(r))}
                    className="card p-4 text-left group hover:-translate-y-1 transition-transform"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[var(--surface-2)]">
                      <img
                        src={track.thumbnail}
                        alt={r.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 grid place-items-center">
                        <span
                          className="w-11 h-11 rounded-full grid place-items-center text-white"
                          style={{ background: "linear-gradient(135deg, var(--accent), #f973b6)" }}
                        >
                          {active && isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                        </span>
                      </span>
                      {active && (
                        <span className="absolute top-2 left-2 badge" style={{ background: "var(--accent)", color: "#fff" }}>
                          Now
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm truncate">{r.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">{r.blurb}</div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Search results */}
          {results.length > 0 && (
            <Section title={`Results for “${query}”`} icon={<Search size={16} />}>
              <div className="space-y-1">
                {results.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    onPlay={() => playQueue([...results], i)}
                    isCurrent={current?.id === t.id && provider === "youtube"}
                    isPlaying={isPlaying}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <Section
              title="Queue"
              icon={<ListMusic size={16} />}
              action={
                <div className="flex items-center gap-2">
                  <input
                    className="input !py-1.5 w-40 text-sm"
                    placeholder="Playlist name…"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCurrentQueue()}
                  />
                  <button onClick={saveCurrentQueue} disabled={saving} className="btn-secondary !py-2 text-sm">
                    <Plus size={15} /> Save
                  </button>
                </div>
              }
            >
              <TrackQueueList queue={queue} queueIndex={queueIndex} isPlaying={isPlaying} onPlay={playQueue} />
            </Section>
          )}
        </div>

        {/* Right column: library */}
        <div className="space-y-6">
          <Section title="Favorites" icon={<Heart size={16} />}>
            {favorites.length === 0 ? (
              <EmptyHint text="Tap the ♥ on any track to save it here." />
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto nice-scroll">
                {favorites.map((t) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    onPlay={() => playQueue(favorites, favorites.indexOf(t))}
                    onActive={t.provider !== "spotify" ? () => play(t) : undefined}
                    isCurrent={current?.id === t.id && provider === t.provider}
                    isPlaying={isPlaying}
                    trailing={<HeartOn isFav onToggle={() => toggleFavorite(t)} />}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Recent"
            icon={<History size={16} />}
            action={
              recents.length > 0 ? (
                <button onClick={resetRecent} className="text-xs text-[var(--text-muted)] hover:text-red-500">
                  Clear
                </button>
              ) : undefined
            }
          >
            {recents.length === 0 ? (
              <EmptyHint text="Songs you play will show up here." />
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto nice-scroll">
                {recents.map((t) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    onPlay={() => play(t)}
                    isCurrent={current?.id === t.id && provider === t.provider}
                    isPlaying={isPlaying}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Saved playlists" icon={<ListMusic size={16} />}>
            {playlists.length === 0 ? (
              <EmptyHint text="Save a queue as a playlist to keep a mix ready." />
            ) : (
              <div className="space-y-2">
                {playlists.map((p) => (
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] grid place-items-center text-[var(--accent)] shrink-0">
                      <ListMusic size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{p.items.length} tracks</div>
                    </div>
                    {p.items.length > 0 && (
                      <button
                        onClick={() => playQueue(p.items, 0)}
                        className="p-2 rounded-xl hover:bg-[var(--surface-2)] text-[var(--accent)]"
                        aria-label="Play"
                      >
                        <Play size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deletePlaylist(p.id)}
                      className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500"
                      aria-label="Delete playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Spotify now playing is inside the embed; still show a mini queue info */}
    </motion.div>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-bold text-sm text-[var(--text-muted)] flex items-center gap-1.5">
          <span className="text-[var(--accent)]">{icon}</span> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProviderBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
        active ? "bg-white dark:bg-[var(--surface)] shadow-soft text-[var(--text)]" : "text-[var(--text-muted)]"
      }`}
    >
      <span className={active ? "text-[var(--accent)]" : ""}>{icon}</span>
      {label}
    </button>
  );
}

function TrackRow({
  track,
  onPlay,
  onActive,
  isCurrent,
  isPlaying,
  trailing,
}: {
  track: Track;
  onPlay: () => void;
  onActive?: () => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-center gap-3 p-2 rounded-2xl transition-colors ${
        isCurrent ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
      }`}
    >
      <button onClick={onPlay} className="relative w-11 h-11 rounded-xl overflow-hidden bg-[var(--surface-2)] flex-shrink-0">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="w-full h-full grid place-items-center text-[var(--accent)]">
            {track.provider === "spotify" ? <Music2 size={18} /> : <Disc3 size={18} />}
          </span>
        )}
        <span
          className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 bg-black/30 text-white transition-opacity"
        >
          {isCurrent && isPlaying ? <Pause size={18} /> : <Play size={16} />}
        </span>
        {isCurrent && isPlaying && (
          <span className="absolute inset-0 grid place-items-center text-white" onClick={(e) => { e.stopPropagation(); onActive?.(); }}>
            <Pause size={16} fill="currentColor" className="opacity-90" />
          </span>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{track.title}</div>
        <div className="text-[11px] text-[var(--text-muted)] truncate">
          {track.artist} · {track.provider === "spotify" ? "Spotify" : "YouTube"}
        </div>
      </div>
      {trailing}
    </div>
  );
}

function TrackQueueList({
  queue,
  queueIndex,
  isPlaying,
  onPlay,
}: {
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  onPlay: (q: Track[], i: number) => void;
}) {
  return (
    <div className="card p-2 space-y-0.5 max-h-80 overflow-y-auto nice-scroll">
      {queue.map((t, i) => {
        const isCur = i === queueIndex;
        return (
          <button
            key={`${t.provider}-${t.id}-${i}`}
            onClick={() => onPlay(queue, i)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
              isCur ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="w-6 text-center text-[var(--text-muted)] font-semibold text-sm">
              {isCur && isPlaying ? (
                <span className="text-[var(--accent)]"><Pause size={14} /></span>
              ) : isCur ? (
                <span className="text-[var(--accent)]"><Play size={14} /></span>
              ) : (
                i + 1
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{t.title}</div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">{t.artist}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function HeartOn({ isFav, onToggle }: { isFav: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
      aria-label={isFav ? "Unfavorite" : "Favorite"}
    >
      <Heart size={16} className={isFav ? "text-[var(--accent)] fill-[var(--accent)]" : "text-[var(--text-muted)]"} />
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="card p-4 text-center text-sm text-[var(--text-muted)] bg-[var(--surface-2)]/50 !border-dashed">
      {text}
    </div>
  );
}