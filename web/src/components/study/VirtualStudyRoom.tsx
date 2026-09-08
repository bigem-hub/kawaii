import { useEffect, useRef, useState, useCallback } from "react";
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
  Square,
  Trash2,
  Type,
  Users,
  Video,
  VideoOff,
  X,
  Link2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/store/useAuth";
import { api } from "@/lib/api";

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

function getRandomColor(exclude: string[] = []) {
  const available = COLORS.filter(c => !exclude.includes(c));
  return available[Math.floor(Math.random() * available.length)] || COLORS[0];
}

export function VirtualStudyRoom() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isScreenSharingRef = useRef(false);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [stroke, setStroke] = useState(4);
  const [view, setView] = useState<"room" | "split">("room");
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [hand, setHand] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [studyRoomId, setStudyRoomId] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);

  const getContext = () => canvasRef.current?.getContext("2d") ?? null;
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const snapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) historyRef.current = [...historyRef.current.slice(-20), canvas.toDataURL()];
  };

  const initializeLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camera,
        audio: mic,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get media:", err);
      // Try audio only if video fails
      if (camera) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: mic,
          });
          localStreamRef.current = audioStream;
          return audioStream;
        } catch (audioErr) {
          console.error("Failed to get audio:", audioErr);
        }
      }
      // Return null if all fails - user can still join without media
      return null;
    }
  }, [camera, mic]);

  const createPeerConnection = useCallback((participantId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit("study:ice-candidate", {
          roomId: studyRoomId,
          targetId: participantId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, stream: remoteStream } : p
      ));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setParticipants(prev => prev.filter(p => p.id !== participantId));
        peerConnectionsRef.current.delete(participantId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(participantId, pc);
    return pc;
  }, [studyRoomId]);

  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (!roomId.trim()) return;
    
    setIsCreatingRoom(true);
    try {
      const stream = await initializeLocalMedia();
      
      setStudyRoomId(roomId);
      const socket = getSocket();
      
      // Create local participant
      const localParticipant: Participant = {
        id: user?.id || "local",
        name: user?.displayName || "You",
        color: COLORS[0],
        muted: !mic,
        speaking: false,
        hand: false,
        camera: camera && !!stream?.getVideoTracks().length,
        isLocal: true,
        stream: stream || undefined,
      };
      setParticipants([localParticipant]);

      socket?.emit("study:join", { roomId });

      socket?.on("study:participant-joined", async (data: { participantId: string; participantName: string; participantColor: string }) => {
        const pc = createPeerConnection(data.participantId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("study:offer", {
          roomId,
          targetId: data.participantId,
          offer,
        });
      });

      socket?.on("study:participant-left", (data: { participantId: string }) => {
        setParticipants(prev => prev.filter(p => p.id !== data.participantId));
        const pc = peerConnectionsRef.current.get(data.participantId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.participantId);
        }
      });

      socket?.on("study:offer", async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(data.fromId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("study:answer", {
          roomId,
          targetId: data.fromId,
          answer,
        });
      });

      socket?.on("study:answer", async (data: { fromId: string; answer: RTCSessionDescriptionInit }) => {
        const pc = peerConnectionsRef.current.get(data.fromId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      socket?.on("study:ice-candidate", async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(data.fromId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      socket?.on("study:presence", (data: { count: number }) => {
        setParticipantCount(Math.max(1, data.count));
      });

      socket?.on("study:draw", (drawData: any) => {
        const context = getContext();
        if (!context) return;
        if (drawData.type === "start") {
          context.beginPath();
          context.moveTo(drawData.x, drawData.y);
          context.strokeStyle = drawData.color;
          context.lineWidth = drawData.stroke;
          context.lineCap = "round";
          context.lineJoin = "round";
        } else if (drawData.type === "draw") {
          context.lineTo(drawData.x, drawData.y);
          context.stroke();
        }
      });

      socket?.on("study:clear", () => {
        const context = getContext();
        if (context) {
          context.fillStyle = "#fffdfd";
          context.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          snapshot();
        }
      });

      socket?.on("study:chat", (data: { from: string; message: string }) => {
        setMessages(prev => [...prev, `${data.from}: ${data.message}`]);
      });

      socket?.on("study:hand-raised", (data: { participantId: string; raised: boolean }) => {
        setParticipants(prev => prev.map(p => 
          p.id === data.participantId ? { ...p, hand: data.raised } : p
        ));
      });

      socket?.on("study:mute-changed", (data: { participantId: string; muted: boolean }) => {
        setParticipants(prev => prev.map(p => 
          p.id === data.participantId ? { ...p, muted: data.muted } : p
        ));
      });

    } catch (err) {
      console.error("Failed to join room:", err);
      alert("Failed to join study room");
    } finally {
      setIsCreatingRoom(false);
    }
  }, [user, mic, camera, initializeLocalMedia, createPeerConnection]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    if (studyRoomId) {
      socket?.emit("study:leave", { roomId: studyRoomId });
    }
    
    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Stop screen sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    setParticipants([]);
    setStudyRoomId("");
    setParticipantCount(1);
    setMessages([]);
  }, [studyRoomId]);

  const toggleMic = useCallback(() => {
    const newMic = !mic;
    setMic(newMic);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = newMic;
      });
    }
    const socket = getSocket();
    socket?.emit("study:mute", { roomId: studyRoomId, muted: !newMic });
  }, [mic, studyRoomId]);

  const toggleCamera = useCallback(async () => {
    const newCamera = !camera;
    setCamera(newCamera);
    
    if (newCamera && localStreamRef.current) {
      try {
        const videoTrack = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = videoTrack.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
        
        // Update all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(newTrack);
        });
      } catch (err) {
        console.error("Failed to enable camera:", err);
        setCamera(false);
      }
    } else if (!newCamera && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(null);
        });
      }
    }
  }, [camera]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      isScreenSharingRef.current = false;
      
      // Restore camera track
      if (localStreamRef.current && camera) {
        try {
          const videoTrack = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = videoTrack.getVideoTracks()[0];
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(newTrack);
          peerConnectionsRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === "video");
            if (sender) sender.replaceTrack(newTrack);
          });
        } catch (err) {
          console.error("Failed to restore camera:", err);
        }
      }
    } else {
      // Start screen sharing
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
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(screenTrack);
        }
        
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
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

  const toggleHand = useCallback(() => {
    const newHand = !hand;
    setHand(newHand);
    const socket = getSocket();
    socket?.emit("study:hand", { roomId: studyRoomId, raised: newHand });
  }, [hand, studyRoomId]);

  const sendMessage = useCallback(() => {
    if (!chat.trim()) return;
    const socket = getSocket();
    socket?.emit("study:chat", { roomId: studyRoomId, message: chat.trim() });
    setMessages(prev => [...prev, `You: ${chat.trim()}`]);
    setChat("");
  }, [chat, studyRoomId]);

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = getContext();
    if (!context) return;
    const start = point(event);
    startRef.current = start;
    if (tool === "text") {
      const text = window.prompt("Add a note to the board");
      if (text) { snapshot(); context.fillStyle = color; context.font = "24px Quicksand, sans-serif"; context.fillText(text, start.x, start.y); }
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

    const socket = getSocket();
    socket?.emit("study:draw", {
      roomId: studyRoomId,
      drawData: { type: "start", x: start.x, y: start.y, color: context.strokeStyle, stroke: context.lineWidth },
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
      image.onload = () => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); context.beginPath(); context.strokeStyle = color; context.lineWidth = stroke; context.moveTo(startRef.current.x, startRef.current.y); context.lineTo(next.x, next.y); context.stroke(); };
      image.src = previous;
      return;
    }
    context.lineTo(next.x, next.y);
    context.stroke();

    const socket = getSocket();
    socket?.emit("study:draw", {
      roomId: studyRoomId,
      drawData: { type: "draw", x: next.x, y: next.y },
    });
  };

  const end = () => { drawingRef.current = false; };
  const undo = () => {
    const canvas = canvasRef.current;
    const context = getContext();
    const previous = historyRef.current.at(-2);
    if (!canvas || !context || !previous) return;
    historyRef.current = historyRef.current.slice(0, -2);
    const image = new Image();
    image.onload = () => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); };
    image.src = previous;
  };
  const clear = () => {
    snapshot();
    const context = getContext();
    const canvas = canvasRef.current;
    if (context && canvas) {
      context.fillStyle = "#fffdfd";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const socket = getSocket();
      socket?.emit("study:clear", { roomId: studyRoomId });
    }
  };
  const exportCanvas = () => { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement("a"); link.download = "study-board.png"; link.href = canvas.toDataURL("image/png"); link.click(); };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
  };

  const handleCreateRoom = async () => {
    try {
      const res = await api.post<{ roomId: string }>("/study/create-room", {});
      const roomId = res.roomId;
      setInviteCode(roomId);
      setShowInviteModal(true);
      handleJoinRoom(roomId);
    } catch (err) {
      console.error("Failed to create room:", err);
      alert("Failed to create study room");
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinCode.trim()) return;
    handleJoinRoom(joinCode.trim());
    setShowJoinModal(false);
    setJoinCode("");
  };

  // ParticipantVideo component for proper hook usage
  const ParticipantVideo = ({ participant }: { participant: Participant }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
      if (participant.stream && videoRef.current) {
        videoRef.current.srcObject = participant.stream;
      }
    }, [participant.stream]);

    return (
      <div className={`relative aspect-video rounded-2xl overflow-hidden border-2 ${participant.speaking ? "border-[var(--accent)]" : "border-white/70 dark:border-[var(--border)]"} bg-white/70 dark:bg-black/10`}>
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
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-soft" style={{ background: participant.color }}>
              {participant.name[0]}
            </div>
          </div>
        )}
        <div className="absolute left-2 bottom-2 text-xs font-semibold bg-black/40 text-white rounded-lg px-2 py-1">
          {participant.name}{participant.isLocal && " (You)"}
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          {participant.muted && <span className="p-1 rounded-md bg-black/40 text-white"><MicOff size={12} /></span>}
          {participant.speaking && <span className="p-1 rounded-md bg-[var(--accent)] text-white"><Headphones size={12} /></span>}
          {participant.hand && <span className="p-1 rounded-md bg-yellow-400 text-white"><Hand size={12} /></span>}
          {!participant.camera && <span className="p-1 rounded-md bg-red-500 text-white"><VideoOff size={12} /></span>}
        </div>
      </div>
    );
  };

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
            <p className="text-sm text-[var(--text-muted)] mt-1">Create or join a study room to collaborate with friends</p>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <button 
              className="btn-primary w-full py-4 text-lg" 
              onClick={handleCreateRoom}
              disabled={isCreatingRoom}
            >
              {isCreatingRoom ? "Creating..." : "Create Study Room"}
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
              />
              <button className="btn-primary" onClick={handleJoinWithCode} disabled={!joinCode.trim()}>
                Join Room
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
            {participantCount} study buddies in room • Room: <code className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-xs font-mono">{studyRoomId}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-2)]">
            <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === "room" ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"}`} onClick={() => setView("room")}>Room view</button>
            <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === "split" ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"}`} onClick={() => setView("split")}>Split view</button>
          </div>
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => { setInviteCode(studyRoomId); setShowInviteModal(true); }}>
            <Link2 size={14} /> Invite
          </button>
          <button className="btn-danger text-xs" onClick={leaveRoom}>Leave</button>
        </div>
      </div>
      <div className={`grid ${view === "split" ? "lg:grid-cols-[0.72fr_1.28fr]" : "lg:grid-cols-[1fr_280px]"}`}>
        <div className="p-5 bg-gradient-to-br from-[#f3efff] via-[#fff1f6] to-[#edfff8] dark:from-[var(--surface-2)] dark:via-[var(--surface)] dark:to-[var(--surface-2)]">
          <div className={`grid ${view === "split" ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
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
            <button className={`btn-secondary text-xs ${isScreenSharingRef.current ? "bg-blue-500 text-white" : ""}`} onClick={toggleScreenShare}>
              <MonitorUp size={15} /> {isScreenSharingRef.current ? "Stop Sharing" : "Share Screen"}
            </button>
            <button className={`btn-secondary text-xs ${hand ? "bg-yellow-100 text-yellow-700" : ""}`} onClick={toggleHand}>
              <Hand size={15} /> {hand ? "Lower Hand" : "Raise Hand"}
            </button>
            <button className="btn-danger text-xs" onClick={leaveRoom}>
              <X size={15} /> Leave Room
            </button>
          </div>
        </div>
        <div className="p-5 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Room Chat</h3>
            <span className="badge bg-green-50 text-green-600">Live</span>
          </div>
          <div className="space-y-3 mt-4 min-h-32 max-h-44 overflow-y-auto">
            {messages.map((message, index) => (
              <p key={`${message}-${index}`} className="text-xs p-2.5 rounded-xl bg-[var(--surface-2)]">{message}</p>
            ))}
            {messages.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No messages yet. Start the conversation!</p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <input
              className="input text-xs"
              value={chat}
              onChange={(event) => setChat(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendMessage()}
              placeholder="Send a message..."
            />
            <button className="btn-primary px-3" onClick={sendMessage} aria-label="Send message" disabled={!chat.trim()}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)]">
            {(["brush", "eraser", "line", "text"] as Tool[]).map((item) => {
              const Icon = item === "brush" ? PenLine : item === "eraser" ? Eraser : item === "line" ? Minus : Type;
              return (
                <button
                  key={item}
                  className={`p-2 rounded-lg ${tool === item ? "bg-white dark:bg-[var(--surface)] shadow-sm text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
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
            <input className="w-20 accent-[var(--accent)]" type="range" min="1" max="18" value={stroke} onChange={(event) => setStroke(Number(event.target.value))} />
          </label>
          <div className="ml-auto flex gap-1">
            <button className="btn-ghost text-xs" onClick={undo}><RotateCcw size={14} /> Undo</button>
            <button className="btn-ghost text-xs" onClick={clear}><Trash2 size={14} /> Clear</button>
            <button className="btn-secondary text-xs" onClick={exportCanvas}><Download size={14} /> Export</button>
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
              <button className="p-1 text-[var(--text-muted)]" onClick={() => setShowInviteModal(false)} aria-label="Close"><X size={20} /></button>
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
                  />
                  <button className="btn-secondary" onClick={copyInviteCode}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)]">Share this code with friends so they can join your study room</p>
              <button className="btn-primary w-full" onClick={() => { navigator.clipboard.writeText(inviteCode); alert("Room code copied!"); }}>
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}