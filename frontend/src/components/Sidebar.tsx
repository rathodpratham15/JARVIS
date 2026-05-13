import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  CameraIcon,
  FaceSmileIcon,
  EyeIcon,
  PuzzlePieceIcon,
  BookOpenIcon,
  DocumentTextIcon,
  HeartIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, description: 'System overview' },
  { name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon, description: 'AI conversations' },
  { name: 'Voice Input', href: '/voice-input', icon: MicrophoneIcon, description: 'Speech recognition' },
  { name: 'Camera Recognition', href: '/camera-recognition', icon: CameraIcon, description: 'Real-time detection' },
  { name: 'Face Recognition', href: '/face-recognition', icon: FaceSmileIcon, description: 'Identity verification' },
  { name: 'Visual Analysis', href: '/visual-analysis', icon: EyeIcon, description: 'Image processing' },
  { name: 'Plugins', href: '/plugins', icon: PuzzlePieceIcon, description: 'Extensions & tools' },
  { name: 'Memory', href: '/memory', icon: BookOpenIcon, description: 'Conversation history' },
  { name: 'Notes', href: '/notes', icon: DocumentTextIcon, description: 'Quick notes' },
  { name: 'Emotion Analysis', href: '/emotion-analysis', icon: HeartIcon, description: 'Mood detection' },
  { name: 'System Control', href: '/system-control', icon: Cog6ToothIcon, description: 'System management' },
];

const Sidebar: React.FC = () => {
  return (
    <div className="w-72 bg-background border-r border-border/40 shadow-sm flex flex-col min-h-0">
      {/* Logo Section - Simplified */}
      <Card className="border-0 shadow-none rounded-none flex-shrink-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Cog6ToothIcon className="w-7 h-7 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="flex-shrink-0" />

      {/* Navigation */}
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Navigation
        </div>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `group relative flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-md transition-colors ${
                  isActive ? 'bg-primary-foreground/20' : 'group-hover:bg-accent'
                }`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar; 