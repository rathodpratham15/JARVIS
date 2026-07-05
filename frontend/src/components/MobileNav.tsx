import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/config/nav';

export const MobileNav: React.FC = () => (
  <nav
    className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#040d1d] border-t border-[rgba(0,180,255,0.2)] flex overflow-x-auto"
    data-testid="mobile-nav"
    style={{ WebkitOverflowScrolling: 'touch' }}
  >
    {NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            [
              'flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] shrink-0 transition-colors',
              isActive ? 'text-[#00d4ff]' : 'text-[#4a7fa0]',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="w-5 h-5" style={{ color: isActive ? '#00d4ff' : '#4a7fa0' }} />
              <span
                className="font-hud-mono text-[9px] tracking-wider leading-none"
                style={{ color: isActive ? '#00d4ff' : '#4a7fa0' }}
              >
                {item.name.split(' ')[0].toUpperCase()}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#00d4ff]" />
              )}
            </>
          )}
        </NavLink>
      );
    })}
  </nav>
);
