import React, { useState, useRef } from "react";
import {
  Puzzle,
  Upload,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PluginItem } from "../types";
import { playUiSound } from "../utils/audio";

interface PluginsViewProps {
  plugins: PluginItem[];
  onTogglePlugin: (name: string) => void;
  onInstallPlugin: (file: File) => Promise<string[]>;
  onDeletePlugin: (name: string) => void;
}

const TEMPLATE = `from jarvis.plugins import BasePlugin, PluginManifest


class MyPlugin(BasePlugin):
    def get_manifest(self) -> PluginManifest:
        return PluginManifest(
            name="my_plugin",
            version="0.1.0",
            description="Describe what this plugin does.",
            author="your-name",
            keywords=["trigger", "word"],
            priority=100,
        )

    def run(self, query: str, **kwargs) -> str:
        return f"My plugin handled: {query}"
`;

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  onTogglePlugin,
  onInstallPlugin,
  onDeletePlugin,
}) => {
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playUiSound("scan");
    setInstalling(true);
    setInstallResult(null);
    const installed = await onInstallPlugin(file);
    setInstalling(false);
    if (installed.length > 0) {
      playUiSound("success");
      setInstallResult(`Installed: ${installed.join(", ")}`);
    } else {
      setInstallResult("Install failed — check the file and try again.");
    }
    // Reset so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (name: string) => {
    playUiSound("alert");
    setDeletingName(name);
    await onDeletePlugin(name);
    setDeletingName(null);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(TEMPLATE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 11</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Plugin Marketplace
          </h1>
          <p className="label-secondary mt-1">
            EXTEND JARVIS WITH CUSTOM PYTHON MODULES
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#F2F2EF] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a]">
            {plugins.filter(p => p.enabled).length} OF {plugins.length} ACTIVE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Installed plugins */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 01</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">Installed Plugins</h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Plugins are auto-discovered from the <code className="font-mono bg-[#EBEBEA] px-1">plugins/</code> directory
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {plugins.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#1a1a1a]/30 bg-[#EBEBEA] font-mono text-xs text-[#555]">
                No plugins installed. Upload a <code>.py</code> file in Panel 02 to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {plugins.map(plugin => (
                  <div
                    key={plugin.id}
                    className="p-5 border border-[#1a1a1a] bg-[#EBEBEA] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 border border-[#1a1a1a] bg-[#F2F2EF] shrink-0">
                          <Puzzle className="w-4 h-4 text-[#1a1a1a]" />
                        </div>
                        <div>
                          <h3 className="font-mono font-bold text-sm text-[#1a1a1a]">{plugin.name}</h3>
                          <p className="font-mono text-[10px] text-[#555]">
                            v{plugin.version}{plugin.author ? ` · ${plugin.author}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] font-bold text-[#555]">
                          {plugin.enabled ? "ENABLED" : "DISABLED"}
                        </span>
                        <button
                          onClick={() => onTogglePlugin(plugin.name)}
                          className={`w-9 h-5 border border-[#1a1a1a] transition p-0.5 flex items-center ${
                            plugin.enabled ? "bg-[#00E5FF] justify-end" : "bg-[#ccc] justify-start"
                          }`}
                          title={plugin.enabled ? "Disable" : "Enable"}
                        >
                          <div className="w-3.5 h-3.5 bg-black" />
                        </button>
                        <button
                          onClick={() => handleDelete(plugin.name)}
                          disabled={deletingName === plugin.name}
                          className="p-1.5 border border-[#1a1a1a] bg-transparent hover:bg-rose-100 text-[#1a1a1a] transition"
                          title="Uninstall plugin"
                        >
                          {deletingName === plugin.name
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <p className="font-mono text-xs text-[#555] leading-relaxed">
                      {plugin.description || "No description provided."}
                    </p>

                    {plugin.keywords && plugin.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {plugin.keywords.map(kw => (
                          <span
                            key={kw}
                            className="font-mono text-[9px] px-1.5 py-0.5 bg-[#1a1a1a] text-[#00E5FF] font-bold"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#1a1a1a]/20 flex items-center gap-3 font-mono text-[10px] text-[#555]">
                      <span>PRIORITY: <strong className="text-[#1a1a1a]">{plugin.priority ?? 100}</strong></span>
                      <span
                        className={`px-1.5 py-0.5 font-bold text-[9px] border ${
                          plugin.enabled
                            ? "bg-emerald-100 border-emerald-600 text-emerald-700"
                            : "bg-[#F2F2EF] border-[#1a1a1a]/30 text-[#555]"
                        }`}
                      >
                        {plugin.enabled ? "ACTIVE" : "IDLE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Install + Template */}
        <div className="lg:col-span-5 space-y-6">
          {/* Install Panel */}
          <div className="editorial-panel space-y-5">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">Install Plugin</h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Upload a <code className="font-mono bg-[#EBEBEA] px-1">.py</code> file that subclasses <code className="font-mono bg-[#EBEBEA] px-1">BasePlugin</code>
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#1a1a1a] bg-[#EBEBEA] p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#E0E0DE] transition"
            >
              {installing ? (
                <RefreshCw className="w-6 h-6 text-[#555] animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-[#555]" />
              )}
              <p className="font-mono text-xs text-[#555] text-center">
                {installing ? "Installing…" : "Click to upload a .py plugin file"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".py"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {installResult && (
              <p className={`font-mono text-xs px-3 py-2 border ${
                installResult.startsWith("Installed")
                  ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                  : "bg-rose-50 border-rose-400 text-rose-700"
              }`}>
                {installResult}
              </p>
            )}

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>PLUGIN ENGINE</span>
                <span className="font-bold text-[#1a1a1a]">Python 3.12 hot-load</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>TRIGGER</span>
                <span className="font-bold text-[#1a1a1a]">Keyword matching</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>DISCOVERY</span>
                <span className="font-bold text-[#1a1a1a]">Auto on upload</span>
              </div>
            </div>
          </div>

          {/* Template Panel */}
          <div className="editorial-panel space-y-4">
            <div>
              <div className="overline-cyan">PANEL 03</div>
              <h2 className="font-serif text-xl font-bold text-[#1a1a1a]">Starter Template</h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Copy this, fill in your logic, and upload it above
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <button
              onClick={() => setTemplateOpen(v => !v)}
              className="w-full flex items-center justify-between font-mono text-xs text-[#555] hover:text-[#1a1a1a] transition py-1"
            >
              <span>{templateOpen ? "Hide template" : "Show template"}</span>
              {templateOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {templateOpen && (
              <div className="relative">
                <pre className="bg-[#1a1a1a] text-[#00E5FF] font-mono text-[10px] p-4 overflow-x-auto leading-relaxed rounded-none max-h-64 overflow-y-auto">
                  {TEMPLATE}
                </pre>
                <button
                  onClick={handleCopyTemplate}
                  className="absolute top-2 right-2 p-1.5 bg-[#00E5FF] border border-[#000] text-black hover:bg-white transition"
                  title="Copy template"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            <p className="font-mono text-[10px] text-[#555] leading-relaxed">
              Plugins intercept chat messages via <code className="bg-[#EBEBEA] px-0.5">can_handle()</code> (keyword match) and return a response from <code className="bg-[#EBEBEA] px-0.5">run()</code>. Higher <code className="bg-[#EBEBEA] px-0.5">priority</code> wins when multiple match.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
