import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckSquare, ChevronDown, ChevronUp, Clock3, Heading1, Heading2, Lightbulb, Minus, Plus, Trash2 } from "lucide-react";

type BlockType = "text" | "todo" | "callout" | "heading1" | "heading2" | "timer" | "divider";
type Block = { id: string; type: BlockType; content: string; checked?: boolean; icon?: string };

type Command = { type: Exclude<BlockType, "text">; label: string; description: string; icon: typeof CheckSquare };

const COMMANDS: Command[] = [
  { type: "todo", label: "To-do", description: "Track one actionable item", icon: CheckSquare },
  { type: "callout", label: "Callout", description: "Highlight a useful idea", icon: Lightbulb },
  { type: "heading1", label: "Heading 1", description: "Create a large section title", icon: Heading1 },
  { type: "heading2", label: "Heading 2", description: "Create a smaller section title", icon: Heading2 },
  { type: "timer", label: "Mini timer", description: "Embed a focused 5-minute timer", icon: Clock3 },
  { type: "divider", label: "Divider", description: "Separate two thoughts", icon: Minus },
];

const createBlock = (type: BlockType): Block => ({
  id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  content: type === "divider" ? "" : type === "todo" ? "New task" : type === "callout" ? "A useful reminder" : type === "timer" ? "5:00" : "",
  checked: false,
  icon: type === "callout" ? "!" : undefined,
});

function MiniTimer() {
  const [seconds, setSeconds] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) {
        setRunning(false);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const toggle = () => setRunning((value) => !value);
  return <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-2)]"><Clock3 size={17} className="text-[var(--accent)]" /><span className="font-bold tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span><button className="btn-secondary text-xs ml-auto" onClick={toggle}>{running ? "Pause" : "Start"}</button><button className="btn-ghost text-xs" onClick={() => { setRunning(false); setSeconds(300); }}>Reset</button></div>;
}

export function SlashCommandEditor() {
  const [blocks, setBlocks] = useState<Block[]>([createBlock("text")]);
  const [activeBlock, setActiveBlock] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const updateBlock = (index: number, content: string) => {
    setBlocks((current) => current.map((block, position) => position === index ? { ...block, content } : block));
    setActiveBlock(index);
    setMenuOpen(content.endsWith("/"));
    setMenuIndex(0);
  };

  const insertCommand = (command: Command) => {
    setBlocks((current) => current.flatMap((block, index) => index === activeBlock ? [createBlock(command.type)] : [block]));
    setMenuOpen(false);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const addTextBlock = (after: number) => {
    setBlocks((current) => [...current.slice(0, after + 1), createBlock("text"), ...current.slice(after + 1)]);
    setActiveBlock(after + 1);
  };

  const removeBlock = (index: number) => {
    setBlocks((current) => current.length === 1 ? current : current.filter((_, position) => position !== index));
    setActiveBlock(Math.max(0, index - 1));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveBlock(target);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
    if (menuOpen) {
      if (event.key === "ArrowDown") { event.preventDefault(); setMenuIndex((value) => (value + 1) % COMMANDS.length); }
      if (event.key === "ArrowUp") { event.preventDefault(); setMenuIndex((value) => (value - 1 + COMMANDS.length) % COMMANDS.length); }
      if (event.key === "Enter") { event.preventDefault(); insertCommand(COMMANDS[menuIndex]); }
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addTextBlock(index); }
    if (event.key === "Backspace" && !blocks[index].content) { event.preventDefault(); removeBlock(index); }
  };

  return <section className="card p-5 md:p-6">
    <div className="flex items-start justify-between gap-3 mb-5"><div><div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Document blocks</div><h2 className="text-xl font-bold mt-1">Quick study notes</h2><p className="text-sm text-[var(--text-muted)] mt-1">Type / inside a block to insert a building block.</p></div><button className="btn-secondary text-xs" onClick={() => addTextBlock(blocks.length - 1)}><Plus size={15} /> Add block</button></div>
    <div className="space-y-2">
      {blocks.map((block, index) => <div key={block.id} className="group relative flex items-start gap-2">
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity pt-2"><button className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => moveBlock(index, -1)} aria-label="Move block up"><ArrowUp size={13} /></button><button className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => moveBlock(index, 1)} aria-label="Move block down"><ArrowDown size={13} /></button></div>
        <div className="flex-1">
          {block.type === "divider" ? <div className="flex items-center gap-3 py-3"><div className="h-px bg-[var(--border)] flex-1" /><button className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)]" onClick={() => removeBlock(index)} aria-label="Delete divider"><Trash2 size={14} /></button></div> : block.type === "timer" ? <MiniTimer /> : block.type === "todo" ? <label className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-2)]"><input type="checkbox" checked={Boolean(block.checked)} onChange={(event) => setBlocks((current) => current.map((item, position) => position === index ? { ...item, checked: event.target.checked } : item))} className="accent-[var(--accent)]" /><input className={`bg-transparent outline-none flex-1 text-sm ${block.checked ? "line-through text-[var(--text-muted)]" : ""}`} value={block.content} onChange={(event) => updateBlock(index, event.target.value)} onFocus={() => setActiveBlock(index)} onKeyDown={(event) => handleKeyDown(event, index)} /></label> : block.type === "callout" ? <div className="flex gap-3 p-4 rounded-2xl bg-[#fff3d6] dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20"><input className="w-8 bg-transparent text-center font-bold outline-none" value={block.icon} onChange={(event) => setBlocks((current) => current.map((item, position) => position === index ? { ...item, icon: event.target.value } : item))} aria-label="Callout icon" /><textarea className="bg-transparent outline-none resize-none flex-1 text-sm" value={block.content} onChange={(event) => updateBlock(index, event.target.value)} onFocus={() => setActiveBlock(index)} onKeyDown={(event) => handleKeyDown(event, index)} rows={2} /></div> : <textarea ref={index === activeBlock ? editorRef : undefined} className={`w-full resize-none bg-transparent outline-none border-b border-transparent focus:border-[var(--accent)] py-2 ${block.type === "heading1" ? "text-2xl font-bold" : block.type === "heading2" ? "text-lg font-bold" : "text-sm"}`} placeholder={block.type === "heading1" || block.type === "heading2" ? "Untitled section" : "Start writing or type / for commands"} value={block.content} onChange={(event) => updateBlock(index, event.target.value)} onFocus={() => setActiveBlock(index)} onKeyDown={(event) => handleKeyDown(event, index)} rows={block.type.startsWith("heading") ? 1 : 2} />}
          {menuOpen && activeBlock === index && <div className="absolute z-20 left-8 top-full mt-1 w-72 card p-2 shadow-kawaii-lg animate-fade-in"><div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] px-2 py-1">Insert block</div>{COMMANDS.map((command, commandIndex) => { const Icon = command.icon; return <button key={command.type} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left ${menuIndex === commandIndex ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"}`} onMouseDown={(event) => { event.preventDefault(); insertCommand(command); }}><Icon size={16} className="text-[var(--accent)]" /><span className="min-w-0"><span className="block text-sm font-semibold">{command.label}</span><span className="block text-[10px] text-[var(--text-muted)]">{command.description}</span></span></button>; })}</div>}
        </div>
        {block.type !== "divider" && <button className="opacity-0 group-hover:opacity-100 p-2 text-[var(--text-muted)] hover:text-red-500" onClick={() => removeBlock(index)} aria-label="Delete block"><Trash2 size={14} /></button>}
      </div>)}
    </div>
  </section>;
}
