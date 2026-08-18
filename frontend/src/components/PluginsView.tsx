import React, { useState } from "react";
import {
  Puzzle,
  Globe,
  Home,
  Zap,
  Search,
  Shield,
  Terminal,
  CloudSun,
  GitBranch,
  Sliders,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { PluginItem } from "../types";
import { playUiSound } from "../utils/audio";

interface PluginsViewProps {
  plugins: PluginItem[];
  onTogglePlugin: (id: string) => void;
}

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  onTogglePlugin,
}) => {
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null);

  const getPluginIcon = (iconName: string) => {
    switch (iconName) {
      case "Globe":
        return <Globe className="w-6 h-6 text-black" />;
      case "Home":
        return <Home className="w-6 h-6 text-black" />;
      case "Zap":
        return <Zap className="w-6 h-6 text-black" />;
      case "Search":
        return <Search className="w-6 h-6 text-black" />;
      case "Shield":
        return <Shield className="w-6 h-6 text-black" />;
      case "Terminal":
        return <Terminal className="w-6 h-6 text-black" />;
      case "CloudSun":
        return <CloudSun className="w-6 h-6 text-black" />;
      case "GitBranch":
        return <GitBranch className="w-6 h-6 text-black" />;
      default:
        return <Puzzle className="w-6 h-6 text-black" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-mono text-black">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border-2 border-black shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-black tracking-wide">
              MODULAR SUBSYSTEM PLUGINS
            </h2>
            <p className="text-xs font-mono font-bold text-black/70">
              {plugins.filter((p) => p.enabled).length} of {plugins.length} Subsystems Active • Extend J.A.R.V.I.S capabilities
            </p>
          </div>
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className={`p-5 border-2 border-black transition-all duration-200 space-y-3 shadow-[3px_3px_0px_#000000] flex flex-col justify-between ${
              plugin.enabled
                ? "bg-white hover:shadow-[5px_5px_0px_#000000]"
                : "bg-[#f3f3ee] opacity-70"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#00e5ff] border-2 border-black shadow-[2px_2px_0px_#000000]">
                    {getPluginIcon(plugin.iconName)}
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-sm text-black">
                      {plugin.name}
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-black/60 block">
                      {plugin.category} • {plugin.version}
                    </span>
                  </div>
                </div>

                {/* Enable Toggle Switch */}
                <button
                  onClick={() => {
                    playUiSound("beep");
                    onTogglePlugin(plugin.id);
                  }}
                  className={`w-12 h-6 border-2 border-black p-0.5 transition-colors duration-200 flex items-center ${
                    plugin.enabled ? "bg-[#00e5ff] justify-end" : "bg-white justify-start"
                  }`}
                >
                  <div className="w-4 h-4 bg-black border border-black shadow-sm" />
                </button>
              </div>

              <p className="text-xs text-black/80 font-mono leading-relaxed">
                {plugin.description}
              </p>
            </div>

            <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between text-[11px] font-mono">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 border border-black text-[10px] font-black uppercase ${
                  plugin.enabled
                    ? "bg-emerald-400 text-black"
                    : "bg-white text-black/50"
                }`}
              >
                {plugin.enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {plugin.enabled ? "ACTIVE" : "DISABLED"}
              </span>

              <button
                onClick={() => setSelectedPlugin(plugin)}
                className="px-2 py-1 bg-white hover:bg-slate-50 border-2 border-black text-black font-mono font-bold text-[10px] shadow-[2px_2px_0px_#000000] flex items-center gap-1 transition"
              >
                <Sliders className="w-3 h-3" />
                <span>CONFIG</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Config Drawer / Modal */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 bg-white border-2 border-black space-y-4 shadow-[6px_6px_0px_#000000] text-black font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00e5ff] border-2 border-black">
                  {getPluginIcon(selectedPlugin.iconName)}
                </div>
                <div>
                  <h3 className="text-base font-heading font-black text-black">
                    {selectedPlugin.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-black/70">
                    {selectedPlugin.category} • {selectedPlugin.version}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlugin(null)}
                className="p-1 border border-black hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-black font-mono">
              <p className="p-3 bg-[#f3f3ee] border-2 border-black font-bold">{selectedPlugin.description}</p>

              <div className="p-3 bg-[#f3f3ee] border-2 border-black space-y-2 font-mono text-[11px]">
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="text-black/70 font-bold">TELEMETRY LINK:</span>
                  <span className="text-black font-black bg-[#00e5ff] px-1 border border-black">ENCRYPTED (STARK-AES-256)</span>
                </div>
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="text-black/70 font-bold">RESOURCE ALLOCATION:</span>
                  <span className="text-black font-black">0.4% CPU • 12MB RAM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/70 font-bold">HEALTH CHECK:</span>
                  <span className="text-emerald-700 font-black">PASSED (0 ERRORS)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t-2 border-black">
              <button
                onClick={() => setSelectedPlugin(null)}
                className="px-4 py-2 bg-[#00e5ff] hover:bg-[#00c5db] border-2 border-black text-black font-mono font-black text-xs shadow-[2px_2px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
              >
                CLOSE CONFIG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
