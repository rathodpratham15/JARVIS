import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  Camera,
  ScanFace,
  Eye,
  Plug,
  Database,
  StickyNote,
  HeartPulse,
  Cpu,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  name: string;
  desc: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', name: 'Dashboard', desc: 'System overview', icon: LayoutDashboard },
  { path: '/chat', name: 'Chat', desc: 'Converse with JARVIS', icon: MessageSquare },
  { path: '/voice-input', name: 'Voice Input', desc: 'Speech transcription', icon: Mic },
  { path: '/camera-recognition', name: 'Camera', desc: 'Live recognition feed', icon: Camera },
  { path: '/face-recognition', name: 'Face ID', desc: 'Identify people', icon: ScanFace },
  { path: '/visual-analysis', name: 'Visual Analysis', desc: 'Analyze imagery', icon: Eye },
  { path: '/plugins', name: 'Plugins', desc: 'Manage modules', icon: Plug },
  { path: '/memory', name: 'Memory', desc: 'Explore history', icon: Database },
  { path: '/notes', name: 'Notes', desc: 'Quick notes', icon: StickyNote },
  { path: '/emotion-analysis', name: 'Emotion', desc: 'Sentiment scan', icon: HeartPulse },
  { path: '/system-control', name: 'System Control', desc: 'Action center', icon: Cpu },
  { path: '/settings', name: 'Settings', desc: 'Configuration', icon: Settings },
];
