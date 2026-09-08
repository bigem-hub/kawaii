import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Camera,
  CameraOff,
  Download,
  Eraser,
  Hand,
  Headphones,
  Mic,
  MicOff,
  Minus,
  MonitorUp,
  PenLine,
  RotateCcw,
  Send,
  Trash2,
  Type,
  Users,
  VideoOff,
  X,
  Link2,
  Copy,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { api, errMessage } from "@/lib/api";
import {
  joinRoom,
  leaveRoom,
  onPresence,
  onSignal,
  sendSignal,
  sendChat,
  onChat,
  sendBoard,
  onBoard,
  updatePresence,
  type StudyParticipantInfo,
  type StudySignal,
  type StudyBoardEvent,
} from "@/lib/studyRealtime";

type Tool = "brush" | "eraser" | "line" | "text";
type Participant = {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  speaking: boolean;
  hand: boolean;
  camera: boolean;
  isLocal: boolean;
  stream?: MediaStream;
};

const COLORS = ["#ff8fab", "#a78bfa", "#7dd3c7", "#fbbf77", "#60a5fa", "#3d3a3f"];
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VirtualStudyRoom() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isScreenSharingRef = useRef(false);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const unsubsRef = useRef<Array<() => void>>([]);
  const roomIdRef = useRef("");

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [stroke, setStroke] = useState(4);
  const [view, setView] = useState<"room" | "split">("room");
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [hand, setHand] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState<{ key: string; from: string; text: string }[]>([]);
  const [studyRoomId, setStudyRoomId] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const myId = user?.id || "local";
  const myName = user?.displayName || "You";

  const getContext = () => canvasRef.current?.getContext("2d") ?? null;
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const snapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) historyRef.current = [...historyRef.current.slice(-20), canvas.toDataURL()];
  };

  // -------------------------------------------------------------------------
  // Media
  // -------------------------------------------------------------------------
  const initializeLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: camera, audio: mic });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error("Failed to get media:", err);
      if (camera) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: mic });
          localStreamRef.current = audioStream;
          return audioStream;
        } catch (audioErr) {
          console.error("Failed to get audio:", audioErr);
        }
      }
      return null;
    }
  }, [camera, mic]);

  // -------------------------------------------------------------------------
  // WebRTC
  // -------------------------------------------------------------------------
  const flushIce = useCallback(async (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    const pending = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    if (pc) {
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, localStream: MediaStream) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(roomIdRef.current, peerId, {
            from: myId,
            fromName: myName,
            type: "ice",
            payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setParticipants((prev) =>
          prev.map((p) => (p.id === peerId ? { ...p, stream: remoteStream } : p))
        );
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          connectedPeersRef.current.delete(peerId);
        }
      };

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    },
    [myId, myName]
  );

  const ensurePeer = useCallback(
    async (peerId: string) => {
      const localStream = localStreamRef.current;
      if (!localStream || connectedPeersRef.current.has(peerId)) return;
      connectedPeersRef.current.add(peerId);
      const pc = createPeerConnection(peerId, localStream);
      // Glare-free: the lexicographically smaller id is the offerer.
      if (myId < peerId) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(roomIdRef.current, peerId, {
            from: myId,
            fromName: myName,
            type: "offer",
            payload: offer,
          });
        } catch (err) {
          console.error("Failed to create offer:", err);
          connectedPeersRef.current.delete(peerId);
        }
      }
      // else: answerer — wait for their offer in handleSignal
    },
    [createPeerConnection, myId, myName]
  );

  const handleSignal = useCallback(
    async (signal: StudySignal) => {
      const roomId = roomIdRef.current;
      const peerId = signal.from;

      if (signal.type === "offer") {
        let pc = peerConnectionsRef.current.get(peerId);
        if (!pc) {
          if (!localStreamRef.current) return;
          connectedPeersRef.current.add(peerId);
          pc = createPeerConnection(peerId, localStreamRef.current);
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
          await flushIce(peerId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(roomId, peerId, { from: myId, fromName: myName, type: "answer", payload: answer });
        } catch (err) {
          console.error("Failed to answer offer:", err);
        }
      } else if (signal.type === "answer") {
        const pc = peerConnectionsRef.current.get(peerId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
          await flushIce(peerId);
        } catch (err) {
          console.error("Failed to set remote answer:", err);
        }
      } else if (signal.type === "ice") {
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
          } catch {
            /* ignore */
          }
        } else {
          // Buffer until the peer connection has a remote description.
          const pending = pendingIceRef.current.get(peerId) ?? [];
          pending.push(signal.payload as RTCIceCandidateInit);
          pendingIceRef.current.set(peerId, pending);
        }
      }
    },
    [createPeerConnection, flushIce, myId, myName]
  );

  // Reconcile participants + peer connections from the presence map.
  const syncParticipants = useCallback(
    (members: Record<string, StudyParticipantInfo>) => {
      setParticipants((prev) => {
        const local = prev.find((p) => p.isLocal);
        const remote: Participant[] = [];
        for (const [id, info] of Object.entries(members)) {
          if (id === myId) continue;
          const existing = prev.find((p) => p.id === id);
          remote.push({
            id,
            name: info?.name || "Peer",
            color: info?.color || COLORS[0],
            muted: !!info?.muted,
            hand: !!info?.hand,
            camera: !!info?.camera,
            speaking: false,
            isLocal: false,
            stream: existing?.stream,
          });
        }
        return local ? [local, ...remote] : remote;
      });

      const onlineCount = Object.keys(members).length;
      setParticipantCount(Math.max(1, onlineCount));

      for (const id of Object.keys(members)) {
        if (id !== myId && !connectedPeersRef.current.has(id)) {
          ensurePeer(id).catch(() => {});
        }
      }
      for (const id of [...peerConnectionsRef.current.keys()]) {
        if (id !== myId && !(id in members)) {
          peerConnectionsRef.current.get(id)?.close();
          peerConnectionsRef.current.delete(id);
          connectedPeersRef.current.delete(id);
          pendingIceRef.current.delete(id);
        }
      }
    },
    [myId, ensurePeer]
  );

  // -------------------------------------------------------------------------
  // Room join / leave
  // -------------------------------------------------------------------------
  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      if (!roomId.trim()) return;
      setIsCreatingRoom(true);
      try {
        const stream = await initializeLocalMedia();
        localStreamRef.current = stream ?? null;
        roomIdRef.current = roomId;
        setStudyRoomId(roomId);

        const local: Participant = {
          id: myId,
          name: myName,
          color: COLORS[0],
          muted: !mic,
          speaking: false,
          hand: false,
          camera: camera && !!stream?.getVideoTracks().length,
          isLocal: true,
          stream: stream ?? undefined,
        };
        setParticipants([local]);

        const ok = joinRoom(roomId, {
          id: myId,
          name: myName,
          color: COLORS[0],
          camera: local.camera,
          muted: local.muted,
          hand: false,
        });
        if (!ok) {
          toast.error("Study room realtime is not configured (missing Firebase).");
        }

        // Clear any previous listeners, then subscribe fresh.
        unsubsRef.current.forEach((fn) => fn());
        unsubsRef.current = [];
        unsubsRef.current.push(
          onPresence(roomId, syncParticipants),
          onSignal(roomId, myId, handleSignal),
          onChat(roomId, (m) =>
            setMessages((prev) => [
              ...prev,
              { key: `${m.ts}-${m.from}`, from: m.fromName, text: m.text },
            ])
          ),
          onBoard(roomId, applyBoardEvent)
        );
      } catch (err) {
        console.error("Failed to join room:", err);
        toast.error("Failed to join study room");
      } finally {
        setIsCreatingRoom(false);
      }
    },
    [myId, myName, mic, camera, initializeLocalMedia, syncParticipants, handleSignal]
  );

  const cleanupRoom = useCallback(() => {
    unsubsRef.current.forEach((fn) => fn());
    unsubsRef.current = [];
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    connectedPeersRef.current.clear();
    pendingIceRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    isScreenSharingRef.current = false;
  }, []);

  const leaveRoomHandler = useCallback(() => {
    if (roomIdRef.current) leaveRoom(roomIdRef.current, myId);
    cleanupRoom();
    setParticipants([]);
    setStudyRoomId("");
    roomIdRef.current = "";
    setParticipantCount(1);
    setMessages([]);
    toast.success("Left the study room");
  }, [myId, cleanupRoom]);

  // Cleanup listeners / connections on unmount.
  useEffect(() => {
    return () => {
      if (roomIdRef.current) leaveRoom(roomIdRef.current, myId);
      cleanupRoom();
    };
  }, [myId, cleanupRoom]);

  // -------------------------------------------------------------------------
  // Room controls
  // -------------------------------------------------------------------------
  const toggleMic = useCallback(() => {
    const newMic = !mic;
    setMic(newMic);
    localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = newMic));
    if (roomIdRef.current) updatePresence(roomIdRef.current, myId, { muted: !newMic });
    setParticipants((prev) => prev.map((p) => (p.isLocal ? { ...p, muted: !newMic } : p)));
  }, [mic, myId]);

  const toggleHand = useCallback(() => {
    const newHand = !hand;
    setHand(newHand);
    if (roomIdRef.current) updatePresence(roomIdRef.current, myId, { hand: newHand });
    setParticipants((prev) => prev.map((p) => (p.isLocal ? { ...p, hand: newHand } : p)));
  }, [hand, myId]);

  const toggleCamera = useCallback(async () => {
    const newCamera = !camera;
    setCamera(newCamera);

    if (newCamera && localStreamRef.current) {
      try {
        const videoTrack = (await navigator.mediaDevices.getUserMedia({ video: true })).getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(videoTrack);
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        });
        if (roomIdRef.current) updatePresence(roomIdRef.current, myId, { camera: true });
        setParticipants((prev) =>
          prev.map((p) => (p.isLocal ? { ...p, camera: true, stream: localStreamRef.current! } : p))
        );
      } catch (err) {
        console.error("Failed to enable camera:", err);
        setCamera(false);
      }
    } else if (!newCamera && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = false;
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(null);
      });
      if (roomIdRef.current) updatePresence(roomIdRef.current, myId, { camera: false });
      setParticipants((prev) => prev.map((p) => (p.isLocal ? { ...p, camera: false } : p)));
    }
  }, [camera, myId]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      isScreenSharingRef.current = false;
      if (localStreamRef.current && camera) {
        try {
          const videoTrack = (await navigator.mediaDevices.getUserMedia({ video: true })).getVideoTracks()[0];
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(videoTrack);
          });
        } catch (err) {
          console.error("Failed to restore camera:", err);
        }
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        isScreenSharingRef.current = true;
        const screenTrack = screenStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldTrack && localStreamRef.current) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        if (localStreamRef.current) localStreamRef.current.addTrack(screenTrack);
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => {
          isScreenSharingRef.current = false;
          toggleScreenShare();
        };
      } catch (err) {
        console.error("Failed to start screen sharing:", err);
      }
    }
  }, [camera]);

  // -------------------------------------------------------------------------
  // Chat / board
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(() => {
    if (!chat.trim() || !roomIdRef.current) return;
    sendChat(roomIdRef.current, { from: myId, fromName: myName, text: chat.trim() });
    setChat("");
  }, [chat, myId, myName]);

  const applyBoardEvent = useCallback(
    (e: StudyBoardEvent) => {
      if (e.from === myId) return; // don't replay own strokes
      const context = getContext();
      if (!context) return;
      if (e.type === "start") {
        const x = Number(e.x);
        const y = Number(e.y);
        context.beginPath();
        context.moveTo(x, y);
        context.strokeStyle = String(e.color);
        context.lineWidth = Number(e.stroke);
        context.lineCap = "round";
        context.lineJoin = "round";
      } else if (e.type === "draw") {
        context.lineTo(Number(e.x), Number(e.y));
        context.stroke();
      } else if (e.type === "clear") {
        const canvas = canvasRef.current;
        if (canvas) {
          context.fillStyle = "#fffdfd";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    },
    [myId]
  );

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = getContext();
    if (!context) return;
    const start = point(event);
    startRef.current = start;
    if (tool === "text") {
      const text = window.prompt("Add a note to the board");
      if (text) {
        snapshot();
        context.fillStyle = color;
        context.font = "24px Quicksand, sans-serif";
        context.fillText(text, start.x, start.y);
      }
      return;
    }
    snapshot();
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.strokeStyle = tool === "eraser" ? "#fffdfd" : color;
    context.lineWidth = tool === "eraser" ? stroke * 3 : stroke;
    context.lineCap = "round";
    context.lineJoin = "round";
    event.currentTarget.setPointerCapture(event.pointerId);
    sendBoard(roomIdRef.current, {
      from: myId,
      type: "start",
      x: start.x,
      y: start.y,
      color: context.strokeStyle,
      stroke: context.lineWidth,
    });
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = getContext();
    if (!context) return;
    const next = point(event);
    if (tool === "line") {
      const canvas = canvasRef.current;
      const previous = historyRef.current.at(-1);
      if (!canvas || !previous) return;
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = stroke;
        context.moveTo(startRef.current.x, startRef.current.y);
        context.lineTo(next.x, next.y);
        context.stroke();
      };
      image.src = previous;
      return;
    }
    context.lineTo(next.x, next.y);
    context.stroke();
    sendBoard(roomIdRef.current, { from: myId, type: "draw", x: next.x, y: next.y });
  };

  const end = () => {
    drawingRef.current = false;
  };
  const undo = () => {
    const canvas = canvasRef.current;
    const context = getContext();
    const previous = historyRef.current.at(-2);
    if (!canvas || !context || !previous) return;
    historyRef.current = historyRef.current.slice(0, -2);
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
    };
    image.src = previous;
  };
  const clear = () => {
    snapshot();
    const context = getContext();
    const canvas = canvasRef.current;
    if (context && canvas) {
      context.fillStyle = "#fffdfd";
      context.fillRect(0, 0, canvas.width, canvas.height);
      sendBoard(roomIdRef.current, { from: myId, type: "clear" });
    }
  };
  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "study-board.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // -------------------------------------------------------------------------
  // Invite create / join
  // -------------------------------------------------------------------------
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const res = await api.post<{ roomId: string }>("/study/create-room", {});
      const roomId = res.roomId;
      setInviteCode(roomId);
      setShowInviteModal(true);
      await handleJoinRoom(roomId);
    } catch (err) {
      console.error("Failed to create room:", err);
      toast.error(errMessage(err));
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinWithCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setIsCreatingRoom(true);
    try {
      // Validate the room exists before joining.
      await api.get(`/study/room/${code}`);
      await handleJoinRoom(code);
      setJoinCode("");
    } catch (err) {
      console.error("Join failed:", err);
      toast.error("Room not found. Check the invite code and try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const copyInviteCode = () => navigator.clipboard.writeText(inviteCode);

  // -------------------------------------------------------------------------
  // Video tile (separate component for correct hook usage)
  // -------------------------------------------------------------------------
  function ParticipantVideo({ participant }: { participant: Participant }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (participant.stream && videoRef.current) {
        videoRef.current.srcObject = participant.stream;
      }
    }, [participant.stream]);

    return (
      <div
        className={`relative aspect-video rounded-2xl overflow-hidden border-2 ${
          participant.speaking
            ? "border-[var(--accent)]"
            : "border-white/70 dark:border-[var(--border)]"
        } bg-white/70 dark:bg-black/10`}
      >
        {participant.stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-soft"
              style={{ background: participant.color }}
            >
              {participant.name[0]}
            </div>
          </div>
        )}
        <div className="absolute left-2 bottom-2 text-xs font-semibold bg-black/40 text-white rounded-lg px-2 py-1">
          {participant.name}
          {participant.isLocal && " (You)"}
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          {participant.muted && (
            <span className="p-1 rounded-md bg-black/40 text-white">
              <MicOff size={12} />
            </span>
          )}
          {participant.speaking && (
            <span className="p-1 rounded-md bg-[var(--accent)] text-white">
              <Headphones size={12} />
            </span>
          )}
          {participant.hand && (
            <span className="p-1 rounded-md bg-yellow-400 text-white">
              <Hand size={12} />
            </span>
          )}
          {!participant.camera && (
            <span className="p-1 rounded-md bg-red-500 text-white">
              <VideoOff size={12} />
            </span>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: not in a room
  // -------------------------------------------------------------------------
  if (!studyRoomId) {
    return (
      <section className="card overflow-hidden">
        <div className="p-5 md:p-6 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Users size={18} />
              <span className="text-xs uppercase tracking-wider font-semibold">Virtual study room</span>
            </div>
            <h2 className="text-xl font-bold mt-1">Focus together</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Create or join a study room to collaborate with friends
            </p>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <button
              className="btn-primary w-full py-4 text-lg"
              onClick={handleCreateRoom}
              disabled={isCreatingRoom}
            >
              {isCreatingRoom ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> Creating...
                </span>
              ) : (
                "Create Study Room"
              )}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[var(--bg)] px-2 text-[var(--text-muted)]">Or join with a code</span>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter room code"
                className="input flex-1 text-center text-lg tracking-widest"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWithCode()}
                maxLength={8}
                aria-label="Room code"
              />
              <button
                className="btn-primary"
                onClick={handleJoinWithCode}
                disabled={!joinCode.trim() || isCreatingRoom}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Render: in a room
  // -------------------------------------------------------------------------
  return (
    <section className="card overflow-hidden">
      <div className="p-5 md:p-6 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Users size={18} />
            <span className="text-xs uppercase tracking-wider font-semibold">Virtual study room</span>
          </div>
          <h2 className="text-xl font-bold mt-1">Focus together</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {participantCount} study {participantCount === 1 ? "buddy" : "buddies"} in room • Room:{" "}
            <code className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-xs font-mono">
              {studyRoomId}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-2)]">
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                view === "room" ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"
              }`}
              onClick={() => setView("room")}
            >
              Room view
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                view === "split" ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"
              }`}
              onClick={() => setView("split")}
            >
              Split view
            </button>
          </div>
          <button
            className="btn-secondary text-xs flex items-center gap-1"
            onClick={() => {
              setInviteCode(studyRoomId);
              setShowInviteModal(true);
            }}
          >
            <Link2 size={14} /> Invite
          </button>
          <button className="btn-danger text-xs" onClick={leaveRoomHandler}>
            Leave
          </button>
        </div>
      </div>

      <div className={`grid ${view === "split" ? "lg:grid-cols-[0.6fr_0.4fr]" : "lg:grid-cols-[1fr_300px]"}`}>
        <div className="p-5 bg-gradient-to-br from-[#f3efff] via-[#fff1f6] to-[#edfff8] dark:from-[var(--surface-2)] dark:via-[var(--surface)] dark:to-[var(--surface-2)]">
          {/* Participant tiles — side-by-side on sm+ (2 users = 2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {participants.map((person) => (
              <div key={person.id}>
                <ParticipantVideo participant={person} />
              </div>
            ))}
            {participants.length < 4 && (
              <div className="relative aspect-video rounded-2xl border-2 border-dashed border-[var(--border)] bg-white/50 dark:bg-black/5 flex items-center justify-center">
                <div className="text-center text-[var(--text-muted)]">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for participants...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <button className={`btn-secondary text-xs ${!mic ? "text-red-500" : ""}`} onClick={toggleMic}>
              {mic ? <Mic size={15} /> : <MicOff size={15} />} {mic ? "Mute" : "Unmute"}
            </button>
            <button className="btn-secondary text-xs" onClick={toggleCamera}>
              {camera ? <Camera size={15} /> : <CameraOff size={15} />} {camera ? "Camera On" : "Camera Off"}
            </button>
            <button
              className={`btn-secondary text-xs ${isScreenSharingRef.current ? "bg-blue-500 text-white" : ""}`}
              onClick={toggleScreenShare}
            >
              <MonitorUp size={15} /> {isScreenSharingRef.current ? "Stop Sharing" : "Share Screen"}
            </button>
            <button
              className={`btn-secondary text-xs ${hand ? "bg-yellow-100 text-yellow-700" : ""}`}
              onClick={toggleHand}
            >
              <Hand size={15} /> {hand ? "Lower Hand" : "Raise Hand"}
            </button>
            <button className="btn-danger text-xs" onClick={leaveRoomHandler}>
              <X size={15} /> Leave Room
            </button>
          </div>
        </div>

        <div className="p-5 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <MessageSquare size={15} /> Room Chat
            </h3>
            <span className="badge bg-green-50 text-green-600">Live</span>
          </div>
          <div className="space-y-3 mt-4 min-h-32 max-h-44 overflow-y-auto">
            {messages.map((message) => (
              <p key={message.key} className="text-xs p-2.5 rounded-xl bg-[var(--surface-2)]">
                <span className="font-semibold">{message.from}:</span> {message.text}
              </p>
            ))}
            {messages.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                No messages yet. Start the conversation!
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <input
              className="input text-xs"
              value={chat}
              onChange={(event) => setChat(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendMessage()}
              placeholder="Send a message..."
              aria-label="Chat message"
            />
            <button className="btn-primary px-3" onClick={sendMessage} aria-label="Send message" disabled={!chat.trim()}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Whiteboard */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)]">
            {(["brush", "eraser", "line", "text"] as Tool[]).map((item) => {
              const Icon = item === "brush" ? PenLine : item === "eraser" ? Eraser : item === "line" ? Minus : Type;
              return (
                <button
                  key={item}
                  className={`p-2 rounded-lg ${
                    tool === item ? "bg-white dark:bg-[var(--surface)] shadow-sm text-[var(--accent)]" : "text-[var(--text-muted)]"
                  }`}
                  onClick={() => setTool(item)}
                  aria-label={item}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {COLORS.map((item) => (
              <button
                key={item}
                className={`w-6 h-6 rounded-full border-2 ${color === item ? "border-[var(--text)] scale-110" : "border-white"}`}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`Use ${item}`}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Size
            <input
              className="w-20 accent-[var(--accent)]"
              type="range"
              min="1"
              max="18"
              value={stroke}
              onChange={(event) => setStroke(Number(event.target.value))}
            />
          </label>
          <div className="ml-auto flex gap-1">
            <button className="btn-ghost text-xs" onClick={undo}>
              <RotateCcw size={14} /> Undo
            </button>
            <button className="btn-ghost text-xs" onClick={clear}>
              <Trash2 size={14} /> Clear
            </button>
            <button className="btn-secondary text-xs" onClick={exportCanvas}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-auto aspect-[16/9] rounded-2xl border border-[var(--border)] mt-4 cursor-crosshair touch-none"
          onPointerDown={begin}
          onPointerMove={draw}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 bg-[var(--bg)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Invite Friends</h2>
              <button className="p-1 text-[var(--text-muted)]" onClick={() => setShowInviteModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Room Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="input flex-1 text-center text-lg tracking-widest font-mono bg-[var(--surface-2)]"
                    value={inviteCode}
                    aria-label="Invite code"
                  />
                  <button className="btn-secondary" onClick={copyInviteCode} aria-label="Copy invite code">
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Share this code with friends so they can join your study room
              </p>
              <button
                className="btn-primary w-full"
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                  toast.success("Room code copied!");
                  setShowInviteModal(false);
                }}
              >
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
