import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  Eye,
  Plug,
  Database,
  Brain,
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
  { path: '/',              name: 'Dashboard',      desc: 'System overview',       icon: LayoutDashboard },
  { path: '/chat',          name: 'Chat',           desc: 'Converse with JARVIS',  icon: MessageSquare   },
  { path: '/voice-input',   name: 'Voice Input',    desc: 'Speech transcription',  icon: Mic             },
  { path: '/vision',        name: 'Vision',         desc: 'Camera · Face · Scene', icon: Eye             },
  { path: '/intelligence',  name: 'Intelligence',   desc: 'Emotion · Knowledge',   icon: Brain           },
  { path: '/data',          name: 'Data',           desc: 'Memory · Notes',        icon: Database        },
  { path: '/plugins',       name: 'Plugins',        desc: 'Manage modules',        icon: Plug            },
  { path: '/system-control',name: 'System Control', desc: 'Action center',         icon: Cpu             },
  { path: '/settings',      name: 'Settings',       desc: 'Configuration',         icon: Settings        },
];
