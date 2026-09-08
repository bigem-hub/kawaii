import { useEffect, useRef, useState } from "react";
import { CloudRain, Coffee, Flame, Headphones, Pause, Play, RotateCcw, Volume2, VolumeX, Waves } from "lucide-react";

const MODES = {
  focus: { label: "Focus", minutes: 25, tint: "#ff8fab" },
  short: { label: "Short break", minutes: 5, tint: "#7dd3c7" },
  long: { label: "Long break", minutes: 15, tint: "#a78bfa" },
} as const;

type Mode = keyof typeof MODES;
type SoundKey = "rain" | "cafe" | "fire" | "white";

const SOUNDS: Array<{ key: SoundKey; label: string; icon: typeof CloudRain; tone: number }> = [
  { key: "rain", label: "Soft rain", icon: CloudRain, tone: 110 },
  { key: "cafe", label: "Lo-fi cafe", icon: Coffee, tone: 165 },
  { key: "fire", label: "Cozy fireplace", icon: Flame, tone: 82 },
  { key: "white", label: "White noise", icon: Waves, tone: 240 },
];

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function useAmbientAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [activeSound, setActiveSound] = useState<SoundKey | null>(null);
  const [volume, setVolume] = useState<Record<SoundKey, number>>({ rain: 0.18, cafe: 0.12, fire: 0.16, white: 0.1 });

  const stop = () => {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    setActiveSound(null);
  };

  const start = (sound: typeof SOUNDS[number]) => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (activeSound === sound.key) {
      stop();
      return;
    }
    stop();
    const context = contextRef.current ?? new AudioContextClass();
    contextRef.current = context;
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const noise = Math.random() * 2 - 1;
      data[i] = sound.key === "white" ? noise : noise * 0.25 * Math.sin(i / (context.sampleRate / sound.tone));
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = volume[sound.key];
    source.connect(gain).connect(context.destination);
    source.start();
    if (context.state === "suspended") {
      context.resume().catch(console.error);
    }
    sourceRef.current = source;
    gainRef.current = gain;
    setActiveSound(sound.key);
  };

  const changeVolume = (key: SoundKey, value: number) => {
    setVolume((current) => ({ ...current, [key]: value }));
    if (activeSound === key && gainRef.current) gainRef.current.gain.value = value;
  };

  useEffect(() => () => {
    sourceRef.current?.stop();
    contextRef.current?.close();
  }, []);

  return { activeSound, volume, start, stop, changeVolume };
}

export function PomodoroAmbient() {
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(() => readNumber("pomodoroSeconds", MODES.focus.minutes * 60));
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(() => readNumber("pomodoroCycles", 0));
  const { activeSound, volume, start, stop, changeVolume } = useAmbientAudio();
  const totalSeconds = MODES[mode].minutes * 60;
  const progress = Math.max(0, Math.min(100, ((totalSeconds - seconds) / totalSeconds) * 100));
  const radius = 94;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          if (mode === "focus") {
            setCycles((value) => {
              const next = value + 1;
              localStorage.setItem("pomodoroCycles", String(next));
              return next;
            });
          }
          return totalSeconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, running, totalSeconds]);

  useEffect(() => {
    localStorage.setItem("pomodoroSeconds", String(seconds));
  }, [seconds]);

  const chooseMode = (nextMode: Mode) => {
    setRunning(false);
    setMode(nextMode);
    setSeconds(MODES[nextMode].minutes * 60);
  };

  const reset = () => {
    setRunning(false);
    setSeconds(totalSeconds);
  };

  return (
    <section className="card overflow-hidden">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-6 md:p-8 bg-gradient-to-br from-[var(--surface)] via-[var(--surface-2)] to-[#fff0f4] dark:to-[var(--surface)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><Headphones size={17} /> Focus studio</div>
              <h2 className="text-2xl font-bold mt-1">Pomodoro rhythm</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">A gentle timer for deep work and intentional breaks.</p>
            </div>
            <div className="badge bg-white/70 dark:bg-black/10">{cycles} cycles today</div>
          </div>

          <div className="flex gap-2 p-1 mt-6 rounded-2xl bg-white/60 dark:bg-black/10">
            {(Object.keys(MODES) as Mode[]).map((key) => (
              <button key={key} className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${mode === key ? "bg-white dark:bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"}`} onClick={() => chooseMode(key)}>{MODES[key].label}</button>
            ))}
          </div>

          <div className="relative mx-auto mt-7 w-64 h-64">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220" aria-label={`${Math.round(progress)} percent complete`}>
              <circle cx="110" cy="110" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-white/70 dark:text-white/10" />
              <circle cx="110" cy="110" r={radius} fill="none" stroke={MODES[mode].tint} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums tracking-tight">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
              <span className="text-xs text-[var(--text-muted)] mt-2">{MODES[mode].label}</span>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-5">
            <button className="btn-primary min-w-28" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={17} /> : <Play size={17} />} {running ? "Pause" : "Start"}</button>
            <button className="btn-secondary" onClick={reset} aria-label="Reset timer"><RotateCcw size={17} /></button>
          </div>
        </div>

        <div className="p-6 md:p-8 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
          <div className="flex items-center justify-between"><div><h3 className="font-bold">Ambient layer</h3><p className="text-xs text-[var(--text-muted)] mt-1">Generated locally in your browser</p></div><Volume2 size={19} className="text-[var(--accent)]" /></div>
          <div className="space-y-3 mt-5">
            {SOUNDS.map((sound) => {
              const Icon = sound.icon;
              const active = activeSound === sound.key;
              return <div key={sound.key} className={`p-3 rounded-2xl border transition-all ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-3"><button className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)]"}`} onClick={() => start(sound)} aria-label={`${active ? "Stop" : "Play"} ${sound.label}`}>{active ? <VolumeX size={16} /> : <Icon size={16} />}</button><span className="text-sm font-semibold flex-1">{sound.label}</span><span className="text-[10px] text-[var(--text-muted)]">{Math.round(volume[sound.key] * 100)}%</span></div>
                <input className="w-full mt-3 accent-[var(--accent)]" type="range" min="0" max="0.4" step="0.01" value={volume[sound.key]} onChange={(event) => changeVolume(sound.key, Number(event.target.value))} aria-label={`${sound.label} volume`} />
              </div>;
            })}
          </div>
          {activeSound && <button className="btn-ghost text-xs mt-4" onClick={stop}>Stop ambient sound</button>}
        </div>
      </div>
    </section>
  );
}
