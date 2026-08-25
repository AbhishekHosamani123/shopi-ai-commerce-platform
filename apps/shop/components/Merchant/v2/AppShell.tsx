'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CopilotDrawer } from './CopilotDrawer';

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: string[];
  syncAgeSeconds?: number;
}

export function AppShell({ children, breadcrumbs, syncAgeSeconds = 45 }: AppShellProps) {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  const handleOpenCopilot = useCallback(() => {
    setIsCopilotOpen(true);
  }, []);

  const handleCloseCopilot = useCallback(() => {
    setIsCopilotOpen(false);
  }, []);

  const handleCloseMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  const handleToggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(prev => !prev);
  }, []);

  const activeBreadcrumbs = useMemo(() => {
    if (breadcrumbs && breadcrumbs.length > 0) return breadcrumbs;
    if (pathname === '/merchant/sales') return ['Merchant AI', 'Business', 'Sales Analytics'];
    if (pathname === '/merchant/profitability') return ['Merchant AI', 'Business', 'Profitability & Margin'];
    if (pathname === '/merchant/customers') return ['Merchant AI', 'Business', 'Customers & Cohorts'];
    if (pathname === '/merchant/products') return ['Merchant AI', 'Commerce', 'Products'];
    if (pathname === '/merchant/inventory') return ['Merchant AI', 'Commerce', 'Inventory'];
    if (pathname === '/merchant/returns') return ['Merchant AI', 'Commerce', 'Returns & Refunds'];
    if (pathname === '/merchant/actions') return ['Merchant AI', 'Operations', 'Actions & Outcomes'];
    return ['Merchant AI', 'Overview'];
  }, [breadcrumbs, pathname]);

  return (
    <div className="min-h-screen bg-canvas text-ink flex font-sans antialiased selection:bg-linear-primary/30 selection:text-ink">
      {/* 1. Desktop Left Sidebar (>= 1024px) */}
      <div className="hidden lg:block">
        <Sidebar onOpenCopilot={handleOpenCopilot} />
      </div>

      {/* 2. Tablet & Mobile Sidebar Overlay (< 1024px) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            onClick={handleCloseMobileSidebar}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs"
          />
          <div className="relative z-50">
            <Sidebar
              onOpenCopilot={() => {
                handleCloseMobileSidebar();
                handleOpenCopilot();
              }}
              onNavigate={handleCloseMobileSidebar}
            />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-canvas">
        <TopBar
          breadcrumbs={activeBreadcrumbs}
          syncAgeSeconds={syncAgeSeconds}
          onOpenCopilot={handleOpenCopilot}
          onToggleMobileMenu={handleToggleMobileSidebar}
        />

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* 4. Slide-over Copilot Drawer (Single Persistent Instance) */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={handleCloseCopilot}
      />
    </div>
  );
}
