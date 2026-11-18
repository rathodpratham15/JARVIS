import React from "react";
import { API_BASE } from "../utils/api";
import { apiFetch } from "../utils/auth";

export interface PendingConfirm {
  action_id: string;
  tool: string;
  description: string;
}

interface Props {
  pending: PendingConfirm;
  onResolved: (response: string | null) => void;
}

export function ConfirmActionModal({ pending, onResolved }: Props) {
  const [loading, setLoading] = React.useState(false);

  const resolve = async (confirmed: boolean) => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/chat/confirm-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: pending.action_id, confirmed }),
      });
      const data = await res.json();
      onResolved(confirmed ? (data.response ?? null) : null);
    } catch {
      onResolved(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onResolved(null)}
    >
      <div className="w-full sm:max-w-md bg-[#1a1a1a] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">Confirmation Required</p>
            <p className="text-sm text-white/50 mt-0.5">{pending.tool.replace(/_/g, " ")}</p>
          </div>
        </div>

        {/* Action description */}
        <p className="text-sm text-white/80 bg-white/5 rounded-lg px-4 py-3 mb-6 font-mono leading-relaxed">
          {pending.description}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => resolve(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            Deny
          </button>
          <button
            onClick={() => resolve(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-40"
          >
            {loading ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
