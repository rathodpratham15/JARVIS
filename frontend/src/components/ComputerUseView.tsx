import React, { useState, useEffect } from "react";
import {
  Monitor,
  MousePointer,
  Play,
  RefreshCw,
  Terminal,
  Layers,
  Sparkles,
  Camera,
  CheckCircle2,
  CornerDownLeft,
  Crosshair,
} from "lucide-react";
import { ComputerActionStep } from "../types";
import { playUiSound } from "../utils/audio";

export const ComputerUseView: React.FC = () => {
  const [instruction, setInstruction] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [mousePos, setMousePos] = useState({ x: 540, y: 280 });
  const [viewportResolution, setViewportResolution] = useState("1920x1080");

  const [actionHistory, setActionHistory] = useState<ComputerActionStep[]>([
    {
      id: "act-1",
      timestamp: "03:40:10",
      actionType: "screenshot",
      details: "Captured primary virtual display frame (1920x1080 at 60 FPS)",
      status: "success",
    },
    {
      id: "act-2",
      timestamp: "03:40:12",
      actionType: "click",
      coordinates: { x: 540, y: 280 },
      details: "Dispatched left mouse click on [Terminal Search Input]",
      status: "success",
    },
    {
      id: "act-3",
      timestamp: "03:40:15",
      actionType: "type",
      inputPayload: "grep -i 'error' /var/log/system.log",
      details: "Synthesized 38 keystrokes into active terminal buffer",
      status: "success",
    },
  ]);

  const presetInstructions = [
    "Open terminal, run system diagnostics, and export results",
    "Navigate to a website and take a full-screen capture",
    "Open a browser and search for recent AI news",
  ];

  const handleExecuteLoop = async (customPrompt?: string) => {
    const promptToRun = customPrompt || instruction;
    if (!promptToRun.trim() || isExecuting) return;

    playUiSound("beep");
    setIsExecuting(true);
    setCurrentStepIndex(1);

    // Simulated multi-stage computer use loop
    setTimeout(() => {
      setMousePos({ x: 380, y: 210 });
      setActionHistory((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          actionType: "screenshot",
          details: `Captured high-res frame for instruction: "${promptToRun.slice(0, 35)}"`,
          status: "success",
        },
        ...prev,
      ]);
      setCurrentStepIndex(2);
    }, 900);

    setTimeout(() => {
      setMousePos({ x: 720, y: 340 });
      setActionHistory((prev) => [
        {
          id: (Date.now() + 1).toString(),
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          actionType: "click",
          coordinates: { x: 720, y: 340 },
          details: "Located UI bounding box and triggered synthetic left click",
          status: "success",
        },
        ...prev,
      ]);
      setCurrentStepIndex(3);
    }, 1900);

    setTimeout(() => {
      setActionHistory((prev) => [
        {
          id: (Date.now() + 2).toString(),
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          actionType: "type",
          inputPayload: promptToRun,
          details: `Dispatched keyboard input sequence (${promptToRun.length} chars)`,
          status: "success",
        },
        ...prev,
      ]);
      setCurrentStepIndex(4);
      setIsExecuting(false);
      playUiSound("success");
    }, 2900);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 05</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Computer Use
          </h1>
          <p className="label-secondary mt-1">
            MULTIMODAL SCREEN PERCEPTION & SYNTHETIC MOUSE/KEYBOARD AGENT LOOP
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExecuteLoop(presetInstructions[0])}
            disabled={isExecuting}
            className="editorial-btn-primary"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>DISPATCH AUTONOMOUS LOOP</span>
          </button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Viewport & Screen Target (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-white">
                  Virtual Display Viewport
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Real-time interactive desktop canvas with coordinate telemetry
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="p-1 px-2 bg-[#111318] border border-zinc-800 text-white font-bold">
                  CURSOR: X={mousePos.x}, Y={mousePos.y}
                </span>
                <button
                  onClick={() => playUiSound("beep")}
                  className="p-1 px-2 border border-zinc-800 bg-[#00E5FF] text-black font-bold"
                  title="Capture Frame"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Virtual Screen Canvas */}
            <div className="relative border-2 border-zinc-800 bg-[#1a1a1a] p-1 overflow-hidden select-none">
              {/* Window Title Bar */}
              <div className="bg-[#2a2a2a] text-[#EBEBEA] px-3 py-1.5 flex items-center justify-between font-mono text-[10px] border-b border-black">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="ml-2 font-bold text-[#00E5FF]">STARK OS // WORKSHOP TERMINAL</span>
                </div>
                <span className="text-[#888]">1920x1080 @ 60 FPS</span>
              </div>

              {/* Simulated Desktop Content */}
              <div className="bg-[#0f172a] text-cyan-400 p-4 font-mono text-xs min-h-[280px] sm:min-h-[320px] relative overflow-x-auto flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-slate-400 text-[11px]">
                    $ stark-agent --session-id=opt-892 --sandbox=secure
                  </div>
                  <div className="text-emerald-400 text-[11px]">
                    [SUCCESS] Handshake established with J.A.R.V.I.S. Core at 127.0.0.1:3000
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    &gt; Target element located: Button [Export Telemetry CSV] at (X: 720, Y: 340)
                  </div>
                  <div className="text-amber-300 text-[11px]">
                    &gt; Executing simulated cursor displacement...
                  </div>
                </div>

                {/* Simulated Visual Bounding Boxes */}
                <div className="absolute top-16 right-6 border border-[#00E5FF] bg-[#00E5FF]/20 px-2 py-1 text-[10px] text-cyan-200 font-bold">
                  [ARC_TELEMETRY_PORTAL]
                </div>
                <div className="absolute bottom-12 left-10 border border-emerald-400 bg-emerald-400/20 px-2 py-1 text-[10px] text-emerald-200 font-bold">
                  [EXECUTE_SHELL_BUTTON]
                </div>

                {/* Live Synthetic Cursor Crosshair */}
                <div
                  className="absolute pointer-events-none transition-all duration-300 flex items-center gap-1 z-30"
                  style={{ top: `${(mousePos.y / 1080) * 100}%`, left: `${(mousePos.x / 1920) * 100}%` }}
                >
                  <MousePointer className="w-5 h-5 text-[#00E5FF] fill-current drop-shadow" />
                  <span className="bg-black text-[#00E5FF] px-1 text-[9px] font-mono border border-[#00E5FF]">
                    ({mousePos.x}, {mousePos.y})
                  </span>
                </div>

                {/* Bottom Status Ribbon */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>LATENCY: 18ms</span>
                  <span>STATUS: {isExecuting ? "AGENT DISPATCHING" : "IDLE"}</span>
                </div>
              </div>
            </div>

            {/* Viewport Action Controls */}
            <div className="p-3 bg-[#111318] border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="label-secondary">RESOLUTION</span>
                <span className="font-bold text-white">1920x1080 (16:9)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="label-secondary">PERCEPTION MODEL</span>
                <span className="font-bold text-white">GEMINI 2.0 FLASH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Agent Action Loop (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Agent Action Loop
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Dispatch natural language commands into synthetic OS actions
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Command Input Form */}
            <div className="space-y-3">
              <label className="label-secondary">NATURAL LANGUAGE DIRECTIVE</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="E.g. 'Click the export button at X:720 Y:340 and type diagnostic summary'..."
                rows={3}
                className="editorial-input resize-none"
              />
              <button
                onClick={() => handleExecuteLoop()}
                disabled={!instruction.trim() || isExecuting}
                className="editorial-btn-primary w-full py-3"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>PERFORMING ACTIONS...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>EXECUTE ACTION LOOP</span>
                  </>
                )}
              </button>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Preset Actions */}
            <div className="space-y-2.5">
              <span className="label-secondary">PRESET ACTION MACROS</span>
              <div className="space-y-2">
                {presetInstructions.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInstruction(preset)}
                    className="w-full text-left p-2.5 bg-[#111318] hover:bg-[#00E5FF] hover:text-black border border-zinc-800 font-mono text-[11px] text-white transition font-medium"
                  >
                    "{preset}"
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Recent Action Steps Log */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-secondary">ACTION LOG TIMELINE</span>
                <span className="font-mono text-[10px] text-zinc-400">{actionHistory.length} STEPS</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 font-mono text-xs">
                {actionHistory.map((step) => (
                  <div
                    key={step.id}
                    className="p-2.5 bg-[#111318] border border-zinc-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] px-1.5 py-0.2 bg-[#1a1a1a] text-[#00E5FF] font-bold uppercase">
                        {step.actionType}
                      </span>
                      <span className="text-[10px] text-zinc-400">{step.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-white leading-tight">
                      {step.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
