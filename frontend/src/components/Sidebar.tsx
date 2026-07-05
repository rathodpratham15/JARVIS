import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { NAV_ITEMS } from '@/config/nav';
import { MonoLabel } from '@/components/hud/Hud';

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  return (
    <aside
      className="w-56 shrink-0 border-r-2 border-[rgba(0,180,255,0.15)] bg-[#040d1d] overflow-y-auto"
      data-testid="sidebar"
    >
      <div className="px-4 py-4 flex items-center justify-between">
        <MonoLabel>Navigation</MonoLabel>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#4a7fa0] hover:text-[#cae8ff] transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <nav className="px-2 pb-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                [
                  'group flex items-start gap-3 px-3 py-2.5 border-l-2 transition-colors duration-200',
                  isActive
                    ? 'border-l-[#00d4ff] bg-[rgba(0,180,255,0.08)]'
                    : 'border-l-transparent hover:bg-[rgba(0,180,255,0.04)] hover:border-l-[rgba(0,180,255,0.3)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="w-4 h-4 mt-0.5 shrink-0 transition-colors"
                    style={{ color: isActive ? '#00d4ff' : '#4a7fa0' }}
                  />
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium leading-tight"
                      style={{ color: isActive ? '#cae8ff' : '#9fc4e0' }}
                    >
                      {item.name}
                    </div>
                    <div className="font-hud-mono text-[10px] text-[#4a7fa0] leading-tight mt-0.5 truncate">
                      {item.desc}
                    </div>
                  </div>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
