import { ThemeAccent } from "../types";

export interface ThemeConfig {
  id: ThemeAccent;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  bgClass: string;
  cardBgClass: string;
  borderClass: string;
  textPrimaryClass: string;
  textAccentClass: string;
  accentBgClass: string;
  glowClass: string;
  swatchColors: string[];
  isLight?: boolean;
}

export const THEME_CONFIGS: Record<ThemeAccent, ThemeConfig> = {
  cyan: {
    id: "cyan",
    name: "Classic Arc Cyan",
    description: "Classic J.A.R.V.I.S. cyan holographic HUD with deep obsidian canvas",
    primaryColor: "#06b6d4",
    secondaryColor: "#3b82f6",
    bgClass: "bg-slate-950 text-slate-100",
    cardBgClass: "bg-slate-900/90",
    borderClass: "border-cyan-500/30",
    textPrimaryClass: "text-slate-100",
    textAccentClass: "text-cyan-400",
    accentBgClass: "bg-cyan-500",
    glowClass: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    swatchColors: ["#06b6d4", "#0284c7", "#0f172a"],
    isLight: false,
  },
  gold: {
    id: "gold",
    name: "Mark L Hot-Rod Gold",
    description: "Stark Mark 50/85 nanotech armor gold with warm crimson accents",
    primaryColor: "#f59e0b",
    secondaryColor: "#e11d48",
    bgClass: "bg-stone-950 text-amber-50",
    cardBgClass: "bg-stone-900/90",
    borderClass: "border-amber-500/30",
    textPrimaryClass: "text-amber-50",
    textAccentClass: "text-amber-400",
    accentBgClass: "bg-amber-500",
    glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    swatchColors: ["#f59e0b", "#e11d48", "#1c1917"],
    isLight: false,
  },
  crimson: {
    id: "crimson",
    name: "Stark Crimson Armor",
    description: "High-alert red tactical defense suite with fiery glow effects",
    primaryColor: "#f43f5e",
    secondaryColor: "#9333ea",
    bgClass: "bg-zinc-950 text-rose-50",
    cardBgClass: "bg-rose-950/40",
    borderClass: "border-rose-500/30",
    textPrimaryClass: "text-rose-50",
    textAccentClass: "text-rose-400",
    accentBgClass: "bg-rose-500",
    glowClass: "shadow-[0_0_20px_rgba(244,63,94,0.25)]",
    swatchColors: ["#f43f5e", "#be123c", "#18181b"],
    isLight: false,
  },
  emerald: {
    id: "emerald",
    name: "Bio-Grid Emerald",
    description: "Matrix tactical telemetry with high-contrast neon green indicators",
    primaryColor: "#10b981",
    secondaryColor: "#06b6d4",
    bgClass: "bg-zinc-950 text-emerald-50",
    cardBgClass: "bg-emerald-950/30",
    borderClass: "border-emerald-500/30",
    textPrimaryClass: "text-emerald-50",
    textAccentClass: "text-emerald-400",
    accentBgClass: "bg-emerald-500",
    glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    swatchColors: ["#10b981", "#059669", "#09090b"],
    isLight: false,
  },
  cobalt: {
    id: "cobalt",
    name: "Stealth Night Cobalt",
    description: "Deep stealth navy operations with vibrant sapphire glow",
    primaryColor: "#3b82f6",
    secondaryColor: "#6366f1",
    bgClass: "bg-slate-950 text-blue-50",
    cardBgClass: "bg-slate-900/90",
    borderClass: "border-blue-500/30",
    textPrimaryClass: "text-blue-50",
    textAccentClass: "text-blue-400",
    accentBgClass: "bg-blue-500",
    glowClass: "shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    swatchColors: ["#3b82f6", "#1d4ed8", "#020617"],
    isLight: false,
  },
  purple: {
    id: "purple",
    name: "Quantum Violet Matrix",
    description: "Sub-atomic quantum realm particle processor theme",
    primaryColor: "#a855f7",
    secondaryColor: "#ec4899",
    bgClass: "bg-slate-950 text-purple-50",
    cardBgClass: "bg-purple-950/30",
    borderClass: "border-purple-500/30",
    textPrimaryClass: "text-purple-50",
    textAccentClass: "text-purple-400",
    accentBgClass: "bg-purple-500",
    glowClass: "shadow-[0_0_20px_rgba(168,85,247,0.25)]",
    swatchColors: ["#a855f7", "#7e22ce", "#090514"],
    isLight: false,
  },
  light: {
    id: "light",
    name: "Stark Lab Pristine Light",
    description: "High-illumination clean workshop suite with crisp contrast & cerulean optics",
    primaryColor: "#0284c7",
    secondaryColor: "#2563eb",
    bgClass: "bg-slate-100 text-slate-900",
    cardBgClass: "bg-white",
    borderClass: "border-slate-300",
    textPrimaryClass: "text-slate-900",
    textAccentClass: "text-sky-600",
    accentBgClass: "bg-sky-600",
    glowClass: "shadow-[0_4px_20px_rgba(2,132,199,0.15)]",
    swatchColors: ["#0284c7", "#38bdf8", "#f1f5f9"],
    isLight: true,
  },
  brutalist: {
    id: "brutalist",
    name: "Stark Neo-Brutalist",
    description: "Industrial high-contrast cream layout with crisp 2px black borders & electric cyan accents",
    primaryColor: "#00e5ff",
    secondaryColor: "#000000",
    bgClass: "bg-[#f3f3ee] text-black",
    cardBgClass: "bg-white border-2 border-black shadow-[3px_3px_0px_#000000]",
    borderClass: "border-2 border-black",
    textPrimaryClass: "text-black",
    textAccentClass: "text-cyan-600 font-bold",
    accentBgClass: "bg-[#00e5ff] text-black font-bold border-2 border-black shadow-[2px_2px_0px_#000000]",
    glowClass: "shadow-[4px_4px_0px_#000000]",
    swatchColors: ["#00e5ff", "#000000", "#f3f3ee"],
    isLight: true,
  },
};
