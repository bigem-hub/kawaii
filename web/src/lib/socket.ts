import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Connect to a dedicated Socket.IO host. VITE_WS_URL is only set when a
 * persistent WebSocket server exists (e.g. a long-running host). On Vercel
 * serverless there is no Socket.IO server, so we skip connecting entirely —
 * the app relies on REST + polling for live data (chat, watch party).
 */
export function connectSocket(token: string) {
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (!wsUrl) {
    socket = null;
    return null;
  }
  if (socket) {
    socket.disconnect();
  }
  socket = io(wsUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
