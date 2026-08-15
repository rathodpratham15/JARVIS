import React from "react";

interface ArcReactorWidgetProps {
  size?: "sm" | "md" | "lg";
  outputPercent?: string;
  temperatureC?: number;
  interactive?: boolean;
  onClick?: () => void;
  accentColor?: string;
}

export const ArcReactorWidget: React.FC<ArcReactorWidgetProps> = ({
  size = "md",
  outputPercent = "98.7%",
  temperatureC = 38.4,
  interactive = true,
  onClick,
}) => {
  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-36 h-36 sm:w-44 sm:h-44",
    lg: "w-52 h-52 sm:w-60 sm:h-60",
  };

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center rounded-full p-2 bg-[#0d1419] border-2 border-[#1a1a1a] shadow-[0_0_20px_rgba(0,229,255,0.25)] transition-all duration-300 ${
        interactive ? "cursor-pointer hover:scale-105 active:scale-95 group" : ""
      } ${sizeClasses[size]}`}
      title="Click to pulse Arc Core diagnostic"
    >
      {/* Outer Rotating HUD Segment 1 */}
      <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00E5FF]/40 animate-[spin_20s_linear_infinite]" />

      {/* Counter-Rotating Inner Segment 2 */}
      <div className="absolute inset-2 rounded-full border border-[#00E5FF]/50 animate-[spin_12s_linear_infinite_reverse]" />

      {/* Pulsing Core Energy Glow */}
      <div className="absolute inset-5 rounded-full bg-[#00E5FF]/15 blur-sm animate-pulse" />

      {/* SVG Arc Reactor Triangle & Concentric Rings */}
      <svg
        className="absolute inset-0 w-full h-full p-2"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="46" stroke="#00E5FF" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="50" cy="50" r="38" stroke="#00E5FF" strokeWidth="1" opacity="0.8" />
        <polygon points="50,20 76,66 24,66" stroke="#00E5FF" strokeWidth="1.4" opacity="0.85" fill="none" />
        <circle cx="50" cy="50" r="16" stroke="#00E5FF" strokeWidth="1.8" fill="rgba(0,229,255,0.2)" />
        
        {/* Radiating Spoke Lines */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="50"
            x2={50 + 44 * Math.cos((deg * Math.PI) / 180)}
            y2={50 + 44 * Math.sin((deg * Math.PI) / 180)}
            stroke="#00E5FF"
            strokeWidth="0.6"
            opacity="0.4"
          />
        ))}
      </svg>

      {/* Center Core Display */}
      {size !== "sm" && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center select-none">
          <span className="text-[10px] font-mono tracking-widest text-[#00E5FF] font-bold">
            ARC CORE
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-white tracking-wider">
            {outputPercent}
          </span>
          <span className="text-[9px] font-mono text-[#00E5FF]/80 tracking-tight">
            {temperatureC}°C STABLE
          </span>
        </div>
      )}
    </div>
  );
};
