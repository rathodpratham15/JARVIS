import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';

const Layout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#020817]">
      <div className="jv-scanline" aria-hidden />
      <TopBar onMenuClick={openDrawer} />

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-[rgba(2,8,23,0.75)] backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden
          />
        )}

        {/* Mobile slide-in drawer */}
        <div
          className={`md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onClose={closeDrawer} />
        </div>

        {/* Main content — extra bottom padding on mobile to clear the bottom nav */}
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 pb-24 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <MobileNav />

      {/* Footer — desktop only */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
