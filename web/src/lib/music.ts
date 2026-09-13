/**
 * music — shared data layer for the KawaiiLife Music tab.
 *
 * Two streaming paths (both run inside the browser, using the user's own
 * logged-in session — a backend can't DRM-stream arbitrary tracks):
 *
 *  - YouTube (primary): the official YouTube IFrame Player API gives full
 *    transport control (play/pause/seek/volume) and works with any Google
 *    signed-in browser, no app credentials. Album art = the video thumbnail.
 *    Search is available when a VITE_YOUTUBE_API_KEY is set; otherwise
 *    curated radios + paste-a-link (via YouTube oEmbed) still work.
 *
 *  - Spotify (secondary): the Spotify Embed iframe (open.spotify.com/embed)
 *    plays in-browser with its own transport. Full API control needs a
 *    registered app's client credentials + Premium, which we don't have, so
 *    Spotify here is paste-a-link / search-result driven and shown as an embed.
 */

export type MusicProvider = "youtube" | "spotify";

export interface Track {
  id: string; // resource id: youtube video id or spotify track id
  provider: MusicProvider;
  title: string;
  artist: string;
  thumbnail: string; // album-art / embed thumbnail URL
  url: string; // canonical provider URL
  duration?: number; // seconds (youtube, known after load)
}

export interface Playlist {
  id: string;
  name: string;
  items: Track[];
  createdAt?: number;
}

/** Curated radio stations (stable 24/7 Lofi Girl streams — guaranteed live). */
export const CURATED_RADIOS: { name: string; artist: string; videoId: string; color: string; blurb: string }[] = [
  {
    name: "lofi hip hop radio",
    artist: "Lofi Girl",
    videoId: "jfKfPfyJRdk",
    color: "#7c7bc9",
    blurb: "Beats to relax / study to",
  },
  {
    name: "synthwave radio",
    artist: "Lofi Girl",
    videoId: "4xDzrJKXOOY",
    color: "#ff5c8a",
    blurb: "Beats to chill / game to",
  },
  {
    name: "lofi jazz radio",
    artist: "Lofi Girl",
    videoId: "Dx5qFachd3A",
    color: "#f4a261",
    blurb: "Smooth jazz to focus with",
  },
];

export function radioToTrack(
  r: (typeof CURATED_RADIOS)[number]
): Track {
  return {
    id: r.videoId,
    provider: "youtube",
    title: r.name,
    artist: r.artist,
    thumbnail: `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${r.videoId}`,
  };
}

/** CURATED_RADIOS as a playable queue. */
export function curatedQueue(): Track[] {
  return CURATED_RADIOS.map(radioToTrack);
}

// ---------------------------------------------------------------------------
// URL parsing / resolving
// ---------------------------------------------------------------------------

const YT_PATTERNS = [
  /(?:youtube\.com|music\.youtube\.com)\/watch\?.*v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /(?:youtube\.com|music\.youtube\.com)\/embed\/([\w-]{11})/,
  /(?:youtube\.com|music\.youtube\.com)\/shorts\/([\w-]{11})/,
];

export function parseYoutubeUrl(input: string): string | null {
  const url = input.trim();
  if (/^[\w-]{11}$/.test(url)) return url; // raw id
  for (const pat of YT_PATTERNS) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

export function parseSpotifyUrl(input: string): { type: "track" | "album" | "playlist"; id: string } | null {
  const m = input.trim().match(/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return { type: m[1] as any, id: m[2] };
}

/** Resolve a pasted YouTube link to a track via YouTube oEmbed (no API key). */
export async function resolveYoutubeLink(url: string): Promise<Track | null> {
  const id = parseYoutubeUrl(url);
  if (!id) return null;
  const canonical = `https://www.youtube.com/watch?v=${id}`;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      canonical
    )}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error("bad oembed");
    const data = await res.json();
    return {
      id,
      provider: "youtube",
      title: data.title || "Untitled",
      artist: data.author_name || "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: canonical,
    };
  } catch {
    // oEmbed sometimes refuses age / brand channels; fall back to bare metadata
    return {
      id,
      provider: "youtube",
      title: id,
      artist: "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: canonical,
    };
  }
}

const YT_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY as string) || "";

export const canSearch = Boolean(YT_API_KEY);

/** Search YouTube via the Data API (requires VITE_YOUTUBE_API_KEY). */
export async function searchYoutube(query: string): Promise<Track[]> {
  if (!YT_API_KEY) return [];
  const q = encodeURIComponent(query.trim());
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${q}&key=${YT_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed — check your API key");
  const data = await res.json();
  const items: any[] = data?.items || [];
  return items
    .filter((it) => it?.id?.videoId)
    .map((it) => {
      const id: string = it.id.videoId;
      const sn: any = it.snippet || {};
      const thumb =
        sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || "";
      return {
        id,
        provider: "youtube" as const,
        title: sn.title || id,
        artist: sn.channelTitle || "YouTube",
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    });
}

export function spotifyEmbedUrl(track: Track, theme: "0" | "1" = "0"): string {
  return `https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=${theme}&autoplay=1`;
}

export function formatTime(sec: number): string {
  if (!sec || !isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// YouTube IFrame Player API loader
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

let ytApiPromise: Promise<void> | null = null;

/** Load the official YouTube IFrame Player API once. */
export function loadYoutubeApi(): Promise<void> {
  if (typeof window.YT?.Player === "function") {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export const YT_STATES: Record<number, string> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};