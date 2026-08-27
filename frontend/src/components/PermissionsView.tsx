import React, { useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Sliders,
  FolderLock,
  Globe,
  Eye,
  Clock,
  Monitor,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { CapabilityPermission, RiskLevel } from "../types";
import { playUiSound } from "../utils/audio";

interface PermissionsViewProps {
  permissions: CapabilityPermission[];
  onTogglePermission: (id: string) => void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  permissions,
  onTogglePermission,
}) => {
  const [selectedAuditFilter, setSelectedAuditFilter] = useState<"ALL" | "HIGH" | "ALLOWED">("ALL");

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case "HIGH":
        return (
          <span className="font-mono text-[9px] px-2 py-0.5 bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
            HIGH RISK
          </span>
        );
      case "MEDIUM":
        return (
          <span className="font-mono text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-400 font-bold border border-zinc-800">
            MEDIUM RISK
          </span>
        );
      case "LOW":
        return (
          <span className="font-mono text-[9px] px-2 py-0.5 bg-[#111318] text-white font-bold border border-zinc-800">
            LOW RISK
          </span>
        );
    }
  };

  const getCapabilityIcon = (key: string) => {
    switch (key) {
      case "system_control":
        return <Sliders className="w-4 h-4 text-white" />;
      case "file_access":
        return <FolderLock className="w-4 h-4 text-white" />;
      case "web_access":
        return <Globe className="w-4 h-4 text-white" />;
      case "camera_vision":
        return <Eye className="w-4 h-4 text-white" />;
      case "scheduler":
        return <Clock className="w-4 h-4 text-white" />;
      case "computer_use":
        return <Monitor className="w-4 h-4 text-white" />;
      case "reminders":
        return <Bell className="w-4 h-4 text-white" />;
      default:
        return <Shield className="w-4 h-4 text-white" />;
    }
  };

  // Compile all audit logs from permissions
  const allAudits = permissions.flatMap((p) =>
    p.auditLog.map((log) => ({
      ...log,
      permissionName: p.name,
      risk: p.risk,
    }))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 04</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mt-1">
            Permissions
          </h1>
          <p className="label-secondary mt-1">
            STARK ZERO-TRUST CAPABILITY TOGGLES & REAL-TIME RISK BADGING
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#0d0f12] border border-zinc-800 font-mono text-xs font-bold text-white">
            {permissions.filter((p) => p.enabled).length} OF 7 CAPABILITIES GRANTED
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 7 Capability Toggles (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-white">
                  7 Core Capabilities
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Granular permission control across hardware, network, and autonomy layers
                </p>
              </div>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Capability Cards */}
            <div className="space-y-4">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="p-5 border border-zinc-800 bg-[#111318] space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 border border-zinc-800 bg-[#111318] flex items-center justify-center">
                        {getCapabilityIcon(perm.key)}
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-bold text-white">
                          {perm.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center">
                      {getRiskBadge(perm.risk)}
                      {/* Cyan Switch / Toggle */}
                      <button
                        onClick={() => {
                          playUiSound("beep");
                          onTogglePermission(perm.id);
                        }}
                        className={`w-9 h-5 border border-zinc-800 transition p-0.5 flex items-center ${
                          perm.enabled ? "bg-white justify-end" : "bg-zinc-700 justify-start"
                        }`}
                        title={perm.enabled ? "Revoke Capability" : "Grant Capability"}
                      >
                        <div className="w-3.5 h-3.5 bg-black" />
                      </button>
                    </div>
                  </div>

                  <p className="font-mono text-xs text-zinc-400 leading-relaxed">
                    {perm.description}
                  </p>

                  <div className="pt-2.5 border-t border-zinc-800/20 flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] text-zinc-400">
                    <span className="truncate">LAST AUDITED: {new Date(perm.lastAudited).toLocaleDateString()}</span>
                    <span>24H CALLS: <strong>{perm.callsCount24h}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Security Telemetry & Audit Log (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Security Audit Log
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Cryptographically signed ledger of agent capability invocations
              </p>
            </div>

            <div className="border-b border-zinc-800" />

            {/* Zero-Trust Posture Card */}
            <div className="p-4 bg-[#111318] border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-white">
                  POSTURE: DEFENSE IN DEPTH
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-800">
                  SECURE
                </span>
              </div>
              <p className="font-mono text-[11px] text-zinc-400">
                All capability changes are logged. Revoked permissions block the corresponding actions immediately.
              </p>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Recent Audit Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-secondary">RECENT INVOCATION LEDGER</span>
                <span className="font-mono text-[10px] text-zinc-400">{allAudits.length} EVENTS</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {allAudits.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#111318] border border-zinc-800 space-y-1 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-bold">
                        {item.timestamp}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-zinc-700 text-white font-bold border border-zinc-600">
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-white font-medium">
                      {item.action}
                    </p>
                    <div className="text-[10px] text-zinc-500">
                      Scope: {item.permissionName}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-zinc-800/30 my-4" />

            {/* Policy Parameters */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>ELEVATED TIMEOUT</span>
                <span className="font-bold text-white">15 MINUTES</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>BIOMETRIC ENFORCEMENT</span>
                <span className="font-bold text-white">MULTI-FACTOR</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>HARDWARE ISOLATION</span>
                <span className="font-bold text-white">CONTAINER SANDBOX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
