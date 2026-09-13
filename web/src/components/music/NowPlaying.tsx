import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Volume2,
  VolumeX,
  Music2,
  ListMusic,
  RotateCcw,
} from "lucide-react";
import { useMusic } from "@/store/useMusic";
import { spotifyEmbedUrl, formatTime } from "@/lib/music";

/**
 * Big now-playing panel for the Music tab. Shows large album art (spinning
 * disc for YouTube), progress + volume sliders, transport controls and a
 * favorite heart. Spotify tracks render their interactive Embed instead,
 * since Spotify's own player controls playback there.
 */
export function NowPlaying() {
  const current = useMusic((s) => s.current);
  const provider = useMusic((s) => s.provider);
  const isPlaying = useMusic((s) => s.isPlaying);
  const loading = useMusic((s) => s.loading);
  const position = useMusic((s) => s.position);
  const duration = useMusic((s) => s.duration);
  const volume = useMusic((s) => s.volume);
  const isFav = useMusic((s) => s.favorites.some((f) => f.id === (s.current?.id ?? "")));
  const toggle = useMusic((s) => s.toggle);
  const next = useMusic((s) => s.next);
  const prev = useMusic((s) => s.prev);
  const seek = useMusic((s) => s.seek);
  const setVolume = useMusic((s) => s.setVolume);
  const toggleFavorite = useMusic((s) => s.toggleFavorite);
  const play = useMusic((s) => s.play);

  if (!current) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center mb-4">
          <Music2 size={36} />
        </div>
        <h3 className="font-bold text-lg">Nothing playing yet</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-xs mt-1">
          Pick a curated radio, search, or paste a music link to start — playback
          keeps going while you work in any tab.
        </p>
      </div>
    );
  }

  // Spotify uses its own interactive embed.
  if (provider === "spotify") {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-black truncate">{current.title}</div>
            <div className="text-sm text-[var(--text-muted)] truncate">{current.artist}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleFavorite(current)}
              className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Favorite"
            >
              <Heart
                size={20}
                className={isFav ? "text-[var(--accent)] fill-[var(--accent)]" : "text-[var(--text-muted)]"}
              />
            </button>
            <button
              onClick={() => play({ ...current, provider: "spotify" })}
              className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)]"
              aria-label="Restart"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        <iframe
          title="Spotify player"
          src={spotifyEmbedUrl(current)}
          width="100%"
          height="380"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-2xl"
        />
      </div>
    );
  }

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Album art */}
        <div className="relative flex-shrink-0">
          <div
            className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-[var(--surface-2)] shadow-kawaii"
            style={{
              boxShadow: `0 20px 60px -20px var(--accent)`,
            }}
          >
            {current.thumbnail ? (
              <img
                src={current.thumbnail}
                alt={current.title}
                className={`w-full h-full object-cover ${isPlaying ? "disc-spin" : ""}`}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-[var(--accent)]">
                <Music2 size={56} />
              </div>
            )}
          </div>
          <span className="absolute -inset-1 rounded-full bg-[var(--accent)] opacity-20 blur-xl -z-10" />
        </div>

        {/* Transport */}
        <div className="flex-1 w-full text-center sm:text-left">
          <span className="inline-flex items-center gap-1 badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <ListMusic size={12} /> YouTube
          </span>
          <h2 className="text-2xl font-black mt-2 leading-tight truncate">{loading ? "Loading…" : current.title}</h2>
          <p className="text-[var(--text-muted)] font-medium truncate">{current.artist}</p>

          {/* Progress */}
          <div className="mt-6">
            <div className="relative h-2 rounded-full bg-[var(--surface-2)] overflow-hidden group">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--accent), #f973b6)" }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={position}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek"
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1.5 px-0.5">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
            <button
              onClick={() => toggleFavorite(current)}
              className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Favorite"
            >
              <Heart
                size={20}
                className={isFav ? "text-[var(--accent)] fill-[var(--accent)]" : "text-[var(--text-muted)]"}
              />
            </button>
            <button
              onClick={prev}
              className="p-3 rounded-2xl hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Previous"
            >
              <SkipBack size={24} />
            </button>
            <button
              onClick={toggle}
              className="w-16 h-16 rounded-full text-white grid place-items-center transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--accent), #f973b6)", boxShadow: `0 12px 30px -10px var(--accent)` }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
            </button>
            <button
              onClick={next}
              className="p-3 rounded-2xl hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Next"
            >
              <SkipForward size={24} />
            </button>

            {/* Volume */}
            <div className="ml-2 hidden md:flex items-center gap-2">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 70)}
                className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)]"
                aria-label="Mute"
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="w-24 accent-[var(--accent)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}