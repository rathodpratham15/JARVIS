import { Menu, Brain, AudioLines, Camera, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { IconTip } from "@/components/common";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

export const PERSONALITIES = [
  { id: "standard", label: "Standard", desc: "Balanced, conversational" },
  { id: "tactical", label: "Tactical", desc: "Direct, brief, action-oriented" },
  { id: "formal", label: "Formal", desc: "Professional, structured" },
  { id: "concise", label: "Concise", desc: "One to two sentences max" },
];

export function MobileMenuButton() {
  const { setMobileOpen } = useApp();
  return (
    <button onClick={() => setMobileOpen(true)} className="md:hidden h-9 w-9 grid place-items-center rounded-lg hover:bg-j-hover" data-testid="mobile-menu-button">
      <Menu className="h-5 w-5" />
    </button>
  );
}

function PersonalitySelect() {
  const { settings, updateSettings } = useApp();
  const current = PERSONALITIES.find((p) => p.id === settings?.personality) || PERSONALITIES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-9 px-3 rounded-lg hover:bg-j-hover flex items-center gap-1.5 text-[17px] font-medium data-[state=open]:bg-j-hover" data-testid="personality-selector">
          J.A.R.V.I.S. <span className="text-j-muted font-normal">{settings ? current.label : ""}</span>
          <ChevronDown className="h-4 w-4 text-j-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-1.5 rounded-2xl">
        <p className="px-2.5 pt-1.5 pb-2 text-xs text-j-muted">Personality</p>
        {PERSONALITIES.map((p) => (
          <DropdownMenuItem
            key={p.id} onSelect={() => updateSettings({ personality: p.id as "standard" | "tactical" | "formal" | "concise" })}
            className="rounded-xl px-2.5 py-2 flex items-center gap-3 cursor-pointer"
          >
            <div className="flex-1">
              <p className="text-sm">{p.label}</p>
              <p className="text-xs text-j-muted">{p.desc}</p>
            </div>
            {p.id === current.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TopBar() {
  const { memories, settings, openModal } = useApp();
  const navigate = useNavigate();
  const memOn = settings?.memory_enabled !== false;
  const memLabel = memOn
    ? `Memory active — ${memories.length} ${memories.length === 1 ? "memory" : "memories"} loaded.`
    : "Memory is off";
  const btn = "h-9 w-9 grid place-items-center rounded-lg hover:bg-j-hover text-j-muted hover:text-j-text transition-colors";

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-2 md:px-3 gap-2" data-testid="top-bar">
      <div className="flex items-center gap-1 min-w-0">
        <MobileMenuButton />
        <PersonalitySelect />
      </div>
      <div className="flex items-center gap-0.5">
        <IconTip label={memLabel} side="bottom">
          <button onClick={() => openModal("settings", { tab: "memory" })} className={`${btn} relative`} data-testid="memory-indicator">
            <Brain className="h-[18px] w-[18px]" />
            {memOn && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>
        </IconTip>
        <IconTip label="Vision" side="bottom">
          <button onClick={() => navigate("/vision")} className={btn} data-testid="topbar-vision-button"><Camera className="h-[18px] w-[18px]" /></button>
        </IconTip>
        <IconTip label="Voice mode" side="bottom">
          <button onClick={() => openModal("voice")} className={btn} data-testid="topbar-voice-button"><AudioLines className="h-[18px] w-[18px]" /></button>
        </IconTip>
      </div>
    </header>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-2 md:px-6 gap-2 border-b border-j-border">
      <div className="flex items-center gap-1 min-w-0">
        <MobileMenuButton />
        <h1 className="text-[17px] font-medium px-2 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

// Suppress unused import warning
export type { LucideIcon };
