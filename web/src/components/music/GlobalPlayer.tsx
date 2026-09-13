import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music2,
  Expand,
} from "lucide-react";
import { useMusic } from "@/store/useMusic";

/**
 * GlobalPlayer mounts two things once (in AppLayout) so music persists across
 * every tab:
 *  1. The hidden YouTube IFrame Player host div — the single player instance.
 *  2. The floating MiniPlayer pill that shows the now-playing track anywhere
 *     in the app and links back to the full Music tab.
 */
export function GlobalPlayer() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Warm the player up (lazy) so the first play is instant.
    useMusic.getState().ensurePlayer().catch(() => {});
    // Load user library once.
    if (!useMusic.getState().dataLoaded) {
      useMusic.getState().refreshData().catch(() => {});
    }
  }, []);

  return (
    <>
      {/* Hidden YT player host (kept mounted & visible to the browser engine, but positioned offscreen so audio plays) */}
      <div
        id="kawaii-music-player"
        aria-hidden="true"
        className="fixed -top-[9999px] -left-[9999px] w-[300px] h-[200px] pointer-events-none opacity-0 z-[-1]"
      />

      <MiniPlayer />
    </>
  );
}

function MiniPlayer() {
  const current = useMusic((s) => s.current);
  const provider = useMusic((s) => s.provider);
  const isPlaying = useMusic((s) => s.isPlaying);
  const loading = useMusic((s) => s.loading);
  const duration = useMusic((s) => s.duration);
  const position = useMusic((s) => s.position);
  const toggle = useMusic((s) => s.toggle);
  const next = useMusic((s) => s.next);
  const prev = useMusic((s) => s.prev);
  const setProvider = useMusic((s) => s.setProvider);

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="card !rounded-2xl p-2 pl-2.5 flex items-center gap-3 shadow-kawaii">
            {/* thumbnail */}
            <Link
              to="/music"
              className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--surface-2)]"
            >
              {current.thumbnail ? (
                <img
                  src={current.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-[var(--accent)]">
                  <Music2 size={20} />
                </div>
              )}
              {isPlaying && (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] ring-2 ring-white dark:ring-[var(--surface)]" />
              )}
            </Link>

            {/* meta */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight truncate">
                {loading ? "Loading…" : current.title}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                {current.artist} · {provider === "spotify" ? "Spotify" : "YouTube"}
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {provider !== "spotify" && (
                <>
                  <button
                    onClick={prev}
                    className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
                    aria-label="Previous"
                  >
                    <SkipBack size={18} />
                  </button>
                  <button
                    onClick={toggle}
                    className="p-2 rounded-xl text-white transition-all"
                    style={{ background: "linear-gradient(135deg, var(--accent), #f973b6)" }}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={next}
                    className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
                    aria-label="Next"
                  >
                    <SkipForward size={18} />
                  </button>
                </>
              )}
              <Link
                to="/music"
                onClick={() => setProvider(provider)}
                className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)]"
                aria-label="Open Music"
              >
                <Expand size={18} />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}