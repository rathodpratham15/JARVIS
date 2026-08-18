import React, { useState } from "react";
import {
  Bell,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { ReminderItem } from "../types";
import { playUiSound, speakJarvisText } from "../utils/audio";

interface RemindersViewProps {
  reminders: ReminderItem[];
  onAddReminder: (item: Omit<ReminderItem, "id" | "isTriggered">) => void;
  onDismissReminder: (id: string) => void;
  onSnoozeReminder: (id: string, minutes: number) => void;
  onDeleteReminder: (id: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  onAddReminder,
  onDismissReminder,
  onSnoozeReminder,
  onDeleteReminder,
}) => {
  const [title, setTitle] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [priority, setPriority] = useState<ReminderItem["priority"]>("HIGH");
  const [selectedSound, setSelectedSound] = useState("Default Chime");

  const quickPresets = [
    { label: "+15m", mins: 15 },
    { label: "+1 Hour", mins: 60 },
    { label: "+4 Hours", mins: 240 },
    { label: "Tomorrow 09:00", mins: 1440 },
  ];

  const handleQuickPreset = (mins: number) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    setTargetTime(d.toISOString().slice(0, 16));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetTime) return;

    playUiSound("beep");
    onAddReminder({
      title: title.trim(),
      targetTime,
      priority,
      soundAlert: selectedSound,
      isDismissed: false,
    });

    setTitle("");
    setTargetTime("");
    playUiSound("success");
  };

  const handleTestAlarm = (r: ReminderItem) => {
    playUiSound("beep");
    speakJarvisText(`Priority alarm for ${r.title}.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1a1a1a] pb-6">
        <div>
          <div className="overline-cyan">// J.A.R.V.I.S. INTERFACE 07</div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1a1a1a] mt-1">
            Reminders
          </h1>
          <p className="label-secondary mt-1">
            MISSION-CRITICAL SCHEDULED ALARMS & AUDIO SYNTHESIS NOTIFICATIONS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playUiSound("beep");
              speakJarvisText("Audio notification test. All audio channels clear.");
            }}
            className="editorial-btn-outline"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>TEST AUDIO CHIME</span>
          </button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Reminders List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="editorial-panel space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="overline-cyan">PANEL 01</div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                  Scheduled Alarms
                </h2>
                <p className="text-xs text-[#555] font-sans mt-0.5">
                  Synchronized time-critical triggers and voice alerts
                </p>
              </div>
              <span className="p-1.5 px-2.5 bg-[#EBEBEA] border border-[#1a1a1a] font-mono text-[11px] font-bold text-[#1a1a1a]">
                {reminders.filter((r) => !r.isDismissed).length} ACTIVE
              </span>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            {/* Reminders List */}
            <div className="space-y-4">
              {reminders.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#1a1a1a]/30 bg-[#EBEBEA] font-mono text-xs text-[#555]">
                  No active alarms. Schedule a time-critical reminder in Panel 02.
                </div>
              ) : (
                reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-5 border border-[#1a1a1a] bg-[#EBEBEA] space-y-3 transition ${
                      reminder.isDismissed ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[9px] px-2 py-0.5 font-bold uppercase border border-[#1a1a1a] ${
                            reminder.priority === "CRITICAL"
                              ? "bg-[#1a1a1a] text-[#00E5FF]"
                              : reminder.priority === "HIGH"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-white text-[#1a1a1a]"
                          }`}
                        >
                          {reminder.priority}
                        </span>
                        <span className="font-mono text-xs text-[#555] font-bold">
                          ALARM TIME: {new Date(reminder.targetTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <button
                          onClick={() => handleTestAlarm(reminder)}
                          className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-black/5 text-[#1a1a1a]"
                          title="Trigger Alarm Preview"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteReminder(reminder.id)}
                          className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-rose-100 text-[#1a1a1a]"
                          title="Delete Alarm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-[#1a1a1a]">
                      {reminder.title}
                    </h3>

                    {/* Action Row */}
                    <div className="pt-3 border-t border-[#1a1a1a]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                      <div className="text-[11px] text-[#555]">
                        CHIME: <strong className="text-[#1a1a1a]">{reminder.soundAlert || "Default Chime"}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSnoozeReminder(reminder.id, 15)}
                          className="editorial-btn-outline py-1 px-2.5 text-[10px]"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>SNOOZE +15M</span>
                        </button>
                        <button
                          onClick={() => onDismissReminder(reminder.id)}
                          className="editorial-btn-primary py-1 px-3 text-[10px]"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{reminder.isDismissed ? "DISMISSED" : "DISMISS"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Schedule Alarm Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="editorial-panel space-y-6">
            <div>
              <div className="overline-cyan">PANEL 02</div>
              <h2 className="font-serif text-2xl font-bold text-[#1a1a1a]">
                New Alarm
              </h2>
              <p className="text-xs text-[#555] font-sans mt-0.5">
                Register time-critical alerts with synthetic speech dispatch
              </p>
            </div>

            <div className="border-b border-[#1a1a1a]" />

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-secondary">REMINDER TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.G. MARK 85 ARMOR FLIGHT TRIAL RUN..."
                  className="editorial-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-secondary">TARGET DATE & TIME</label>
                <input
                  type="datetime-local"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="editorial-input"
                  required
                />
              </div>

              {/* Quick Offset Buttons */}
              <div className="space-y-1.5">
                <label className="label-secondary">QUICK PRESETS</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {quickPresets.map((qp) => (
                    <button
                      key={qp.label}
                      type="button"
                      onClick={() => handleQuickPreset(qp.mins)}
                      className="p-1.5 bg-[#EBEBEA] hover:bg-[#00E5FF] hover:text-black border border-[#1a1a1a] font-mono text-[10px] font-bold text-[#1a1a1a] transition"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-secondary">PRIORITY LEVEL</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="editorial-input"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="ROUTINE">ROUTINE</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="label-secondary">AUDIO ALERT CHIME</label>
                  <select
                    value={selectedSound}
                    onChange={(e) => setSelectedSound(e.target.value)}
                    className="editorial-input"
                  >
                    <option value="Default Chime">Default Chime</option>
                    <option value="Alert Siren">Alert Siren</option>
                    <option value="Subtle Pulse">Subtle Pulse</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!title.trim() || !targetTime}
                className="editorial-btn-primary w-full py-3"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ARM TIME-CRITICAL ALARM</span>
              </button>
            </form>

            <div className="border-b border-dashed border-[#1a1a1a]/30 my-4" />

            {/* Alarm Subsystem Telemetry */}
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-[#555]">
                <span>AUDIO ENGINE</span>
                <span className="font-bold text-[#1a1a1a]">WEB AUDIO API + TTS SYNTH</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>SNOOZE INTERVAL</span>
                <span className="font-bold text-[#1a1a1a]">15 MINUTES DEFAULT</span>
              </div>
              <div className="flex justify-between text-[#555]">
                <span>WAKE NOTIFICATION</span>
                <span className="font-bold text-[#1a1a1a]">BROWSER FOREGROUND LOOP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
