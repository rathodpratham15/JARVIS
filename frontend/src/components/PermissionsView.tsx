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
          <span className="font-mono text-[9px] px-2 py-0.5 bg-[#1a1a1a] text-[#00E5FF] font-bold border border-[#1a1a1a]">
            HIGH RISK
          </span>
        );
      case "MEDIUM":
        return (
          <span className="font-mono text-[9px] px-2 py-0.5 bg-amber-100 text-amber-900 font-bold border border-[#1a1a1a]">
            MEDIUM RISK
          </span>
        );
      case "LOW":
        return (
          <span className="font-mono text-[9px] px-2 py-0.5 bg-[#EBEBEA] text-[#1a1a1a] font-bold border border-[#1a1a1a]">
            LOW RISK
          </span>
        );
    }
  };

  const getCapabilityIcon = (key: string) => {
    switch (key) {
      case "system_control":
        return <Sliders className="w-4 h-4 text-[#1a1a1a]" />;
      case "file_access":
        return <FolderLock className="w-4 h-4 text-[#1a1a1a]" />;
      case "web_access":
        return <Globe className="w-4 h-4 text-[#1a1a1a]" />;
      case "camera_vision":
        return <Eye className="w-4 h-4 text-[#1a1a1a]" />;
      case "scheduler":
        return <Clock className="w-4 h-4 text-[#1a1a1a]" />;
      case "computer_use":
        return <Monitor className="w-4 h-4 text-[#1a1a1a]" />;
      case "reminders":
        return <Bell className="w-4 h-4 text-[#1a1a1a]" />;
      default:
        return <Shield className="w-4 h-4 text-[#1a1a1a]" />;
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 04</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Permissions
          </h1>
          <p className="label-secondary mt-1">
            STARK ZERO-TRUST CAPABILITY TOGGLES & REAL-TIME RISK BADGING
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 px-3 bg-[#F2F2EF] border border-[#1a1a1a] font-mono text-xs font-bold text-[#1a1a1a]">
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
                <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                  7 Core Capabilities
                </h2>
                <p className="text-xs text-[#555] font-sans mt-0.5">
                  Granular permission control across hardware, network, and autonomy layers
                </p>
              </div>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Capability Cards */}
            <div className="space-y-4">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="p-5 border border-[#1a1a1a] bg-[#EBEBEA] space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 border border-[#1a1a1a] bg-white flex items-center justify-center">
                        {getCapabilityIcon(perm.key)}
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-bold text-[#1a1a1a]">
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
                        className={`w-9 h-5 border border-[#1a1a1a] transition p-0.5 flex items-center ${
                          perm.enabled ? "bg-[#00E5FF] justify-end" : "bg-[#ccc] justify-start"
                        }`}
                        title={perm.enabled ? "Revoke Capability" : "Grant Capability"}
                      >
                        <div className="w-3.5 h-3.5 bg-black" />
                      </button>
                    </div>
                  </div>

                  <p className="font-mono text-xs text-[#555] leading-relaxed">
                    {perm.description}
                  </p>

                  <div className="pt-2.5 border-t border-[#1a1a1a]/20 flex items-center justify-between font-mono text-[10px] text-[#555]">
                    <span>LAST AUDITED: {perm.lastAudited}</span>
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
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                Security Audit Log
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Cryptographically signed ledger of agent capability invocations
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Zero-Trust Posture Card */}
            <div className="p-4 bg-[#EBEBEA] border border-[#1a1a1a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                  POSTURE: DEFENSE IN DEPTH
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]">
                  SECURE
                </span>
              </div>
              <p className="font-mono text-[11px] text-[#555]">
                All capability changes are logged. Revoked permissions block the corresponding actions immediately.
              </p>
            </div>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Recent Audit Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-secondary">RECENT INVOCATION LEDGER</span>
                <span className="font-mono text-[10px] text-[#555]">{allAudits.length} EVENTS</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {allAudits.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#EBEBEA] border border-[#1a1a1a] space-y-1 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#555] font-bold">
                        {item.timestamp}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-[#00E5FF] text-black font-bold border border-[#1a1a1a]">
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1a1a1a] font-medium">
                      {item.action}
                    </p>
                    <div className="text-[10px] text-[#777]">
                      Scope: {item.permissionName}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Policy Parameters */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>ELEVATED TIMEOUT</span>
                <span className="font-bold text-[#1a1a1a]">15 MINUTES</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>BIOMETRIC ENFORCEMENT</span>
                <span className="font-bold text-[#1a1a1a]">STARK LEVEL 5</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>HARDWARE ISOLATION</span>
                <span className="font-bold text-[#1a1a1a]">CONTAINER SANDBOX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
