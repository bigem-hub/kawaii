import {
  ref,
  set,
  push,
  remove,
  update,
  onValue,
  onChildAdded,
  onDisconnect,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import { getRTDB } from "./firebase";

/**
 * Realtime-Database signaling layer for the Virtual Study Room.
 *
 * Replaces the Socket.IO events that were previously used but are a no-op on
 * Vercel serverless. Everything routes through Firebase Realtime Database so
 * the relay is shared state (works across function instances).
 *
 * Path layout under /study/{roomId}:
 *   presence/{userId}   → participant state (name, color, camera, muted, hand, online)
 *   signals/{userId}    → per-user signaling inbox (offer / answer / ice)
 *   chat/{msgId}        → room chat
 *   board/events/{id}   → whiteboard draw/clear events
 */

export type StudyParticipantInfo = {
  name: string;
  color: string;
  camera: boolean;
  muted: boolean;
  hand: boolean;
  online: boolean;
  joinedAt: number;
};

export type StudySignal = {
  from: string;
  fromName?: string;
  type: "offer" | "answer" | "ice";
  payload: unknown; // RTCSessionDescriptionInit | RTCIceCandidateInit
};

export type StudyChatMsg = { from: string; fromName: string; text: string; ts: number };
export type StudyBoardEvent = Record<string, unknown> & { from: string };

export type StudySelf = {
  id: string;
  name: string;
  color: string;
  camera: boolean;
  muted: boolean;
  hand: boolean;
};

function db(): Database | null {
  return getRTDB();
}

function sref(roomId: string, ...path: string[]) {
  return ref(db()!, `study/${roomId}/${path.join("/")}`);
}

/** Join a room: write presence and auto-remove it when this client disconnects. */
export function joinRoom(roomId: string, self: StudySelf): boolean {
  const database = db();
  if (!database) return false;
  const presenceRef = ref(database, `study/${roomId}/presence/${self.id}`);
  set(presenceRef, {
    name: self.name,
    color: self.color,
    camera: self.camera,
    muted: self.muted,
    hand: self.hand,
    online: true,
    joinedAt: Date.now(),
  });
  onDisconnect(presenceRef).remove();
  return true;
}

/** Update fields on this client's own presence node (mute/camera/hand toggles). */
export function updatePresence(roomId: string, userId: string, patch: Partial<StudyParticipantInfo>) {
  const database = db();
  if (!database) return;
  update(sref(roomId, "presence", userId), patch);
}

/** Remove presence + signaling inbox on leave. */
export function leaveRoom(roomId: string, userId: string) {
  const database = db();
  if (!database) return;
  remove(sref(roomId, "presence", userId));
  remove(sref(roomId, "signals", userId));
}

/** Subscribe to the full presence map; callback gets userId → participant info. */
export function onPresence(
  roomId: string,
  cb: (members: Record<string, StudyParticipantInfo>) => void
): Unsubscribe {
  const database = db();
  if (!database) return () => {};
  return onValue(sref(roomId, "presence"), (snap) => {
    cb((snap.val() ?? {}) as Record<string, StudyParticipantInfo>);
  });
}

/** Write a signaling message to a specific participant's inbox. */
export function sendSignal(roomId: string, targetUserId: string, signal: StudySignal) {
  const database = db();
  if (!database) return;
  push(sref(roomId, "signals", targetUserId), { ...signal, ts: Date.now() });
}

/**
 * Subscribe to this client's own signaling inbox. Each message is delivered
 * once and then removed from the DB to keep the inbox small.
 */
export function onSignal(
  roomId: string,
  myUserId: string,
  cb: (s: StudySignal) => void
): Unsubscribe {
  const database = db();
  if (!database) return () => {};
  const inboxRef = sref(roomId, "signals", myUserId);
  return onChildAdded(inboxRef, (snap) => {
    const s = snap.val() as StudySignal;
    if (s && snap.key) {
      cb(s);
      remove(ref(database, `study/${roomId}/signals/${myUserId}/${snap.key}`)).catch(() => {});
    }
  });
}

/** Chat. */
export function sendChat(roomId: string, msg: Omit<StudyChatMsg, "ts">) {
  const database = db();
  if (!database) return;
  push(sref(roomId, "chat"), { ...msg, ts: Date.now() });
}

export function onChat(roomId: string, cb: (msg: StudyChatMsg) => void): Unsubscribe {
  const database = db();
  if (!database) return () => {};
  return onChildAdded(sref(roomId, "chat"), (snap) => {
    const m = snap.val() as StudyChatMsg;
    if (m) cb(m);
  });
}

/** Whiteboard. */
export function sendBoard(roomId: string, event: Omit<StudyBoardEvent, "from" | "ts">) {
  const database = db();
  if (!database) return;
  push(sref(roomId, "board", "events"), { ...event, ts: Date.now() });
}

export function onBoard(roomId: string, cb: (e: StudyBoardEvent) => void): Unsubscribe {
  const database = db();
  if (!database) return () => {};
  return onChildAdded(sref(roomId, "board", "events"), (snap) => {
    const e = snap.val() as StudyBoardEvent;
    if (e) cb(e);
  });
}
