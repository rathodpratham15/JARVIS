import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

const Layout: React.FC = () => (
  <div className="h-screen flex flex-col overflow-hidden bg-[#020817]">
    <div className="jv-scanline" aria-hidden />
    <TopBar />
    <div className="flex-1 flex min-h-0">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" data-testid="main-content">
        <div className="max-w-[1400px] mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
    <Footer />
  </div>
);

export default Layout;
